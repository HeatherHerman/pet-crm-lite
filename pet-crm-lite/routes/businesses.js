const express = require('express');
const { Business } = require('../models/queries');

const router = express.Router();

// Create a new business (supports both JSON and form data)
router.post('/', async (req, res) => {
  try {
    const name = req.body.name || req.body.business_name;
    
    if (!name) {
      return res.status(400).json({ error: 'Business name is required' });
    }
    
    const business = await Business.create(name);
    
    // If it's a form submission, redirect to dashboard
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard');
    }
    
    res.status(201).json(business);
  } catch (err) {
    console.error('Error creating business:', err);
    res.status(500).json({ error: 'Failed to create business' });
  }
});

// List all businesses
router.get('/', async (req, res) => {
  try {
    const businesses = await Business.list();
    res.json(businesses);
  } catch (err) {
    console.error('Error listing businesses:', err);
    res.status(500).json({ error: 'Failed to list businesses' });
  }
});

module.exports = router;