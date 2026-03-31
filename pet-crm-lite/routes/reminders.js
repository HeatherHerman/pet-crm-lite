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
    let eligibleCustomers = 0;
    
    console.log('=== Starting Reminder Generation ===');
    console.log(`Business ID: ${business_id}, Total customers: ${customers.length}`);
    
    for (const customer of customers) {
      // Get last order
      const lastOrder = await Order.getLastOrder(customer.id);
      
      if (!lastOrder) {
        console.log(`[SKIP] ${customer.name} (${customer.pet_name}): No orders yet`);
        continue; // Skip customers with no orders
      }
      
      // Calculate reorder cycle
      const cycleDays = await calculateReorderCycle(customer.id, Order);
      const lastOrderDate = new Date(lastOrder.date);
      const today = new Date();
      const daysSinceOrder = Math.floor((today - lastOrderDate) / (1000 * 60 * 60 * 24));
      
      console.log(`[CHECK] ${customer.name} (${customer.pet_name}):`);
      console.log(`  - Last order date: ${lastOrder.date}`);
      console.log(`  - Days since order: ${daysSinceOrder}`);
      console.log(`  - Computed reorder cycle: ${cycleDays} days`);
      
      // Check if due for reorder
      if (isDueForReorder(lastOrder.date, cycleDays)) {
        eligibleCustomers++;
        const dueDate = new Date(lastOrderDate);
        dueDate.setDate(dueDate.getDate() + cycleDays);
        const dueDateStr = formatDate(dueDate);
        
        console.log(`  - ELIGIBLE: Due for reorder (${daysSinceOrder} >= ${cycleDays})`);
        
        // Check if pending reminder already exists for this cycle
        const exists = await Reminder.existsPendingForCycle(customer.id, dueDateStr);
        
        if (!exists) {
          await Reminder.create(customer.id, dueDateStr);
          generatedCount++;
          console.log(`  - CREATED: Reminder for ${dueDateStr}`);
        } else {
          skippedCount++;
          console.log(`  - SKIPPED: Already has pending reminder for ${dueDateStr}`);
        }
      } else {
        console.log(`  - NOT ELIGIBLE: Not due yet (${daysSinceOrder} < ${cycleDays})`);
      }
    }
    
    console.log('=== Reminder Generation Complete ===');
    console.log(`Generated: ${generatedCount}, Skipped: ${skippedCount}, Eligible: ${eligibleCustomers}`);
    
    // If it's a form submission, redirect to dashboard with success message
    if (req.headers['content-type'] === 'application/x-www-form-urlencoded' || !req.headers['content-type']) {
      // Store message in session or pass via query
      console.log(`✓ ${generatedCount} reminders generated`);
      return res.redirect(`/dashboard?msg=${encodeURIComponent(`${generatedCount} reminders generated`)}`);
    }
    
    res.json({
      message: 'Reminder generation complete',
      generated: generatedCount,
      skipped: skippedCount,
      eligible: eligibleCustomers
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