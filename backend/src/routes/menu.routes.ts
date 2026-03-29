import { Request, Response, Router } from 'express';
import { Prisma } from '@prisma/client';
import multer from 'multer';
import { authenticate, requireAdmin } from '../middlewares/auth';
import { uploadDishImage } from '../lib/cloudinary';
import { prisma } from '../lib/prisma';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024
  },
  fileFilter: (_req, file, callback) => {
    if (!file.mimetype.startsWith('image/')) {
      callback(new Error('Only image files are allowed'));
      return;
    }

    callback(null, true);
  }
});

const getTrimmedString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const getNullableString = (value: unknown) => {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const getNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string' || value.trim() === '') return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const getInteger = (value: unknown) => {
  const parsed = getNumber(value);
  return parsed === undefined ? undefined : Math.trunc(parsed);
};

const resolveCategoryId = async (categoryId: unknown, categoryName: unknown) => {
  const normalizedCategoryId = getTrimmedString(categoryId);
  if (normalizedCategoryId) return normalizedCategoryId;

  const normalizedCategoryName = getTrimmedString(categoryName);
  if (!normalizedCategoryName) return undefined;

  const category = await prisma.category.upsert({
    where: { name: normalizedCategoryName },
    update: {},
    create: { name: normalizedCategoryName }
  });

  return category.id;
};

const isKnownPrismaError = (
  error: unknown
): error is Prisma.PrismaClientKnownRequestError => error instanceof Prisma.PrismaClientKnownRequestError;

const getCloudinaryErrorDetails = (error: unknown) => {
  if (!error || typeof error !== 'object') return null;

  const maybeCloudinaryError = error as {
    message?: string;
    http_code?: number;
    error?: {
      message?: string;
      http_code?: number;
    };
  };

  const message = maybeCloudinaryError.error?.message ?? maybeCloudinaryError.message;
  const httpCode = maybeCloudinaryError.error?.http_code ?? maybeCloudinaryError.http_code;

  if (!message) return null;

  return {
    message,
    httpCode
  };
};

const runSingleImageUpload = (req: Request, res: Response) =>
  new Promise<void>((resolve, reject) => {
    upload.single('image')(req, res, (error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

// Get all menu items with category (publicly accessible, or authed for students)
router.get('/', async (req, res) => {
  try {
    const menu = await prisma.menuItem.findMany({
      include: { category: true }
    });
    res.json(menu);
  } catch (error) {
    console.error('Failed to fetch menu:', error);
    res.status(500).json({ error: 'Failed to fetch menu' });
  }
});

router.post('/upload-image', authenticate, requireAdmin, async (req, res) => {
  try {
    await runSingleImageUpload(req, res);

    if (!req.file) {
      return res.status(400).json({ error: 'Image file is required' });
    }

    const result = await uploadDishImage(req.file);
    res.json({
      imageUrl: result.secure_url,
      publicId: result.public_id
    });
  } catch (error) {
    if (error instanceof multer.MulterError && error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'Image must be 5 MB or smaller' });
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({ error: error.message });
    }

    if (error instanceof Error) {
      if (error.message === 'Only image files are allowed') {
        return res.status(400).json({ error: error.message });
      }

      if (error.message === 'Cloudinary is not configured') {
        return res.status(503).json({
          error: 'Cloudinary is not configured. Add CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET to backend/.env.'
        });
      }
    }

    const cloudinaryError = getCloudinaryErrorDetails(error);
    if (cloudinaryError?.httpCode === 401) {
      console.error('Cloudinary authentication failed:', cloudinaryError.message);
      return res.status(502).json({
        error: 'Cloudinary credentials are invalid. Update CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env, then restart the backend.'
      });
    }

    if (cloudinaryError) {
      console.error('Cloudinary upload failed:', cloudinaryError.message);
      return res.status(502).json({
        error: `Cloudinary upload failed: ${cloudinaryError.message}`
      });
    }

    console.error('Failed to upload menu image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Admin: Add new menu item
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, image, stock, status, categoryId, categoryName } = req.body ?? {};
    const normalizedName = getTrimmedString(name);
    const normalizedPrice = getNumber(price);
    const normalizedCategoryId = await resolveCategoryId(categoryId, categoryName);

    if (!normalizedName) return res.status(400).json({ error: 'Name is required' });
    if (normalizedPrice === undefined) return res.status(400).json({ error: 'A valid price is required' });
    if (!normalizedCategoryId) return res.status(400).json({ error: 'Category requires ID or Name' });

    const menuItem = await prisma.menuItem.create({
      data: {
        name: normalizedName,
        description: getNullableString(description),
        price: normalizedPrice,
        image: getNullableString(image),
        stock: getInteger(stock) ?? 0,
        status: getTrimmedString(status) ?? 'AVAILABLE',
        categoryId: normalizedCategoryId
      },
      include: { category: true }
    });
    
    res.json(menuItem);
  } catch (error) {
    console.error('Failed to create menu item:', error);
    res.status(500).json({ error: 'Failed to create menu item' });
  }
});

// Update stock/status
router.patch('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, price, image, stock, status, categoryId, categoryName } = req.body ?? {};
    const data: Prisma.MenuItemUncheckedUpdateInput = {};

    if (name !== undefined) {
      const normalizedName = getTrimmedString(name);
      if (!normalizedName) return res.status(400).json({ error: 'Name cannot be empty' });
      data.name = normalizedName;
    }

    if (description !== undefined) {
      data.description = getNullableString(description);
    }

    if (price !== undefined) {
      const normalizedPrice = getNumber(price);
      if (normalizedPrice === undefined) return res.status(400).json({ error: 'A valid price is required' });
      data.price = normalizedPrice;
    }

    if (image !== undefined) {
      data.image = getNullableString(image);
    }

    if (stock !== undefined) {
      const normalizedStock = getInteger(stock);
      if (normalizedStock === undefined) return res.status(400).json({ error: 'A valid stock value is required' });
      data.stock = normalizedStock;
    }

    if (status !== undefined) {
      const normalizedStatus = getTrimmedString(status);
      if (!normalizedStatus) return res.status(400).json({ error: 'Status cannot be empty' });
      data.status = normalizedStatus;
    }

    const normalizedCategoryId = await resolveCategoryId(categoryId, categoryName);
    if (normalizedCategoryId) {
      data.categoryId = normalizedCategoryId;
    }

    const menuItem = await prisma.menuItem.update({
      where: { id: req.params.id as string },
      data,
      include: { category: true }
    });

    res.json(menuItem);
  } catch (error) {
    console.error(`Failed to update menu item ${req.params.id}:`, error);
    if (isKnownPrismaError(error) && error.code === 'P2025') {
      return res.status(404).json({ error: 'Menu item not found' });
    }
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// Delete menu item
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    await prisma.menuItem.delete({
      where: { id: req.params.id as string }
    });
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error(`Failed to delete menu item ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

export default router;
