const express = require('express');
const { Reminder, Customer, Order, Business } = require('../models/queries');
const { calculateReorderCycle, isDueForReorder, formatDate } = require('../utils/reminder');

const router = express.Router();

// Generate reminders for a business (supports both JSON and form data)
router.post('/generate/:business_id', async (req, res) => {
  try {
    const { business_id } = req.params;
    
    // Verify business exists
    const business = await Business.getById(business_id);
    if (!business) {
      return res.status(404).json({ error: 'Business not found' });
    }
    
    // Get all customers for this business
    const customers = await Customer.listByBusiness(business_id);
    
    let generatedCount = 0;
    let skippedCount = 0;
    
    for (const customer of customers) {
      // Get last order
      const lastOrder = await Order.getLastOrder(customer.id);
      
      if (!lastOrder) {
        continue; // Skip customers with no orders
      }
      
      // Calculate reorder cycle
      const cycleDays = await calculateReorderCycle(customer.id, Order);
      
      // Check if due for reorder
      if (isDueForReorder(lastOrder.date, cycleDays)) {
        // Calculate due date (last order + cycle)
        const lastOrderDate = new Date(lastOrder.date);
        const dueDate = new Date(lastOrderDate);
        dueDate.setDate(dueDate.getDate() + cycleDays);
        const dueDateStr = formatDate(dueDate);
        
        // Check if pending reminder already exists for this cycle
        const exists = await Reminder.existsPendingForCycle(customer.id, dueDateStr);
        
        if (!exists) {
          await Reminder.create(customer.id, dueDateStr);
          generatedCount++;
        } else {
          skippedCount++;
        }
      }
    }
    
    // If it's a form submission, redirect to dashboard
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded') {
      return res.redirect('/dashboard');
    }
    
    res.json({
      message: 'Reminder generation complete',
      generated: generatedCount,
      skipped: skippedCount
    });
  } catch (err) {
    console.error('Error generating reminders:', err);
    res.status(500).json({ error: 'Failed to generate reminders' });
  }
});

// Get all pending reminders
router.get('/', async (req, res) => {
  try {
    const reminders = await Reminder.list();
    res.json(reminders);
  } catch (err) {
    console.error('Error listing reminders:', err);
    res.status(500).json({ error: 'Failed to list reminders' });
  }
});

// Get WhatsApp link for a customer
router.get('/whatsapp/:customer_id', async (req, res) => {
  try {
    const { customer_id } = req.params;
    
    const customer = await Customer.getById(customer_id);
    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    
    // Get last order for message
    const lastOrder = await Order.getLastOrder(customer_id);
    
    const { generateWhatsAppLink, generateReminderMessage } = require('../utils/reminder');
    
    const message = lastOrder 
      ? generateReminderMessage(customer.pet_name, lastOrder.product)
      : `Hi! Time to restock for ${customer.pet_name}?`;
    
    const link = generateWhatsAppLink(customer.phone, message);
    
    res.json({
      customer_id: customer.id,
      customer_name: customer.name,
      phone: customer.phone,
      pet_name: customer.pet_name,
      last_product: lastOrder?.product,
      message,
      whatsapp_link: link
    });
  } catch (err) {
    console.error('Error generating WhatsApp link:', err);
    res.status(500).json({ error: 'Failed to generate WhatsApp link' });
  }
});

module.exports = router;