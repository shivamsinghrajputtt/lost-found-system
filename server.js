const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const multer = require('multer');
const jwt = require('jsonwebtoken');

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static frontend files
app.use(express.static(path.join(__dirname, "public")));

// Supabase Setup
const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_ANON_KEY || '';
let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('Supabase client initialized.');
} else {
  console.log('Supabase credentials missing. API routes will not work properly until .env is configured.');
}

// API Routes
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

// Multer Setup
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Create Item
app.post('/api/items', upload.single('image'), async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  try {
    const {
      type, title, category, description, location, date, contact_name, contact_email
    } = req.body;

    let image_url = req.body.image_url || null;

    // Handle File Upload to Supabase Storage
    if (req.file) {
      const fileExt = req.file.originalname.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('items-images')
        .upload(fileName, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false
        });

      if (uploadError) {
        console.error('Supabase Storage Error:', uploadError);
        if (uploadError.statusCode === '403') {
          throw new Error(`Image upload failed: 403 Forbidden. Please execute the SQL policy to allow INSERTs on the 'items-images' bucket.`);
        }
        throw new Error(`Image upload failed: ${uploadError.message}`);
      }

      const { data: publicUrlData } = supabase.storage
        .from('items-images')
        .getPublicUrl(fileName);

      image_url = publicUrlData.publicUrl;
    }

    const { data, error } = await supabase
      .from('items')
      .insert([
        {
          type, title, category, description, location,
          item_date: date, contact_name, contact_email,
          image_url, status: 'active'
        }
      ])
      .select();

    if (error) throw error;
    res.status(201).json({ message: 'Item created successfully', data: data[0] });
  } catch (err) {
    console.error('Error creating item:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// List Items
app.get('/api/items', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  try {
    const { type, category, search } = req.query;
    let query = supabase.from('items').select('*').order('created_at', { ascending: false });

    if (type) query = query.eq('type', type);
    if (category) query = query.eq('category', category);
    if (search) {
      query = query.or(`title.ilike.%${search}%,description.ilike.%${search}%,location.ilike.%${search}%,category.ilike.%${search}%`);
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json(data);
  } catch (err) {
    console.error('Error fetching items:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Get Item by ID
app.get('/api/items/:id', async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });

  try {
    const { data, error } = await supabase
      .from('items')
      .select('*')
      .eq('id', req.params.id)
      .single();

    if (error) throw error;
    if (!data) return res.status(404).json({ error: 'Item not found' });

    res.json(data);
  } catch (err) {
    console.error('Error fetching item:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Admin Auth Middleware
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-admin-key';
const ADMIN_USER = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

const authenticateAdmin = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

// Admin Login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
    res.json({ token });
  } else {
    res.status(401).json({ error: 'Invalid credentials' });
  }
});

// Admin Get All Items
app.get('/api/admin/items', authenticateAdmin, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { data, error } = await supabase.from('items').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Update Item Status
app.patch('/api/admin/items/:id', authenticateAdmin, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { status } = req.body;
    const { data, error } = await supabase.from('items').update({ status }).eq('id', req.params.id).select();

    if (error) throw error;
    if (data && data.length === 0) {
      throw new Error('Action blocked by Supabase Row-Level Security. Please ensure UPDATE policies exist on the items table.');
    }

    res.json({ message: 'Item updated', data: data[0] });
  } catch (err) {
    console.error('Update Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

// Admin Delete Item
app.delete('/api/admin/items/:id', authenticateAdmin, async (req, res) => {
  if (!supabase) return res.status(500).json({ error: 'Database not configured' });
  try {
    const { data, error } = await supabase.from('items').delete().eq('id', req.params.id).select();

    if (error) throw error;
    if (data && data.length === 0) {
      throw new Error('Action blocked by Supabase Row-Level Security. Please ensure DELETE policies exist on the items table.');
    }

    res.json({ message: 'Item deleted', data: data[0] });
  } catch (err) {
    console.error('Delete Error:', err.message);
    res.status(400).json({ error: err.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
