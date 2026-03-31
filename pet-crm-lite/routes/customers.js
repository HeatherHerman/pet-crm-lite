const express = require('express');
const { Customer, Pet, Order, Reminder, Business } = require('../models/queries');

const router = express.Router();

// GET all customers (by business_id query param)
router.get('/', async (req, res) => {
  try {
    const { business_id } = req.query;
    if (!business_id) {
      return res.status(400).json({ error: 'business_id is required' });
    }
    const customers = await Customer.listByBusiness(business_id);
    res.json(customers);
  } catch (err) {
    console.error('Error listing customers:', err);
    res.status(500).json({ error: 'Failed to list customers' });
  }
});

// GET single customer with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.getById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    const pets = await Pet.listByCustomer(id);
    const orders = await Order.listByCustomer(id);
    const reminders = await Reminder.getByCustomer(id);
    
    // Get most reordered products
    const productCounts = {};
    orders.forEach(order => {
      productCounts[order.product] = (productCounts[order.product] || 0) + 1;
    });
    const topProducts = Object.entries(productCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([product, count]) => ({ product, count }));
    
    res.json({
      ...customer,
      pets,
      orders,
      reminders,
      topProducts
    });
  } catch (err) {
    console.error('Error getting customer:', err);
    res.status(500).json({ error: 'Failed to get customer' });
  }
});

// POST create new customer
router.post('/', async (req, res) => {
  try {
    const { business_id, name, phone, email, address, notes } = req.body;
    
    if (!business_id || !name || !phone) {
      return res.status(400).json({ error: 'Business ID, name, and phone are required' });
    }
    
    // Check for duplicate
    const existing = await Customer.checkDuplicate(business_id, name, phone);
    if (existing) {
      return res.status(400).json({ 
        error: 'A customer with this name and phone number already exists',
        existing_customer: existing
      });
    }
    
    const customer = await Customer.create(business_id, { name, phone, email, address, notes });
    
    // If it's a form submission, redirect to dashboard
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard?msg=' + encodeURIComponent('Customer added successfully'));
    }
    
    res.status(201).json(customer);
  } catch (err) {
    console.error('Error creating customer:', err);
    res.status(500).json({ error: 'Failed to create customer' });
  }
});

// PUT update customer
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, phone, email, address, notes } = req.body;
    
    const customer = await Customer.getById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Check for duplicate (excluding current customer)
    const existing = await Customer.checkDuplicate(customer.business_id, name, phone, id);
    if (existing) {
      return res.status(400).json({ 
        error: 'A customer with this name and phone number already exists',
        existing_customer: existing
      });
    }
    
    const updated = await Customer.update(id, { name, phone, email, address, notes });
    
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard?msg=' + encodeURIComponent('Customer updated successfully'));
    }
    
    res.json(updated);
  } catch (err) {
    console.error('Error updating customer:', err);
    res.status(500).json({ error: 'Failed to update customer' });
  }
});

// DELETE customer
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const customer = await Customer.getById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    await Customer.delete(id);
    
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard?msg=' + encodeURIComponent('Customer deleted successfully'));
    }
    
    res.json({ message: 'Customer deleted successfully' });
  } catch (err) {
    console.error('Error deleting customer:', err);
    res.status(500).json({ error: 'Failed to delete customer' });
  }
});

// === PETS ===

// POST add pet to customer
router.post('/:id/pets', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, breed, birthdate, notes } = req.body;
    
    const customer = await Customer.getById(id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    if (!name) {
      return res.status(400).json({ error: 'Pet name is required' });
    }
    
    const pet = await Pet.create(id, { name, breed, birthdate, notes });
    
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard/customers/' + id + '?msg=' + encodeURIComponent('Pet added successfully'));
    }
    
    res.status(201).json(pet);
  } catch (err) {
    console.error('Error creating pet:', err);
    res.status(500).json({ error: 'Failed to create pet' });
  }
});

// PUT update pet
router.put('/pets/:pet_id', async (req, res) => {
  try {
    const { pet_id } = req.params;
    const { name, breed, birthdate, notes } = req.body;
    
    const pet = await Pet.getById(pet_id);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    const updated = await Pet.update(pet_id, { name, breed, birthdate, notes });
    res.json(updated);
  } catch (err) {
    console.error('Error updating pet:', err);
    res.status(500).json({ error: 'Failed to update pet' });
  }
});

// DELETE pet
router.delete('/pets/:pet_id', async (req, res) => {
  try {
    const { pet_id } = req.params;
    const pet = await Pet.getById(pet_id);
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
    
    await Pet.delete(pet_id);
    res.json({ message: 'Pet deleted successfully' });
  } catch (err) {
    console.error('Error deleting pet:', err);
    res.status(500).json({ error: 'Failed to delete pet' });
  }
});

module.exports = router;