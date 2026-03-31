const express = require('express');
const { Customer, Order, Business, Reminder } = require('../models/queries');
const { calculateReorderCycle, isDueForReorder, formatDate, generateWhatsAppLink, generateReminderMessage } = require('../utils/reminder');

const router = express.Router();

// Dashboard - main admin interface
router.get('/dashboard', async (req, res) => {
  try {
    // Get first business (assuming single business for now)
    const businesses = await Business.list();
    if (businesses.length === 0) {
      return res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Pet CRM - Setup</title>
          <style>
            body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
            .form-group { margin-bottom: 15px; }
            label { display: block; margin-bottom: 5px; font-weight: bold; }
            input, select { width: 100%; padding: 10px; box-sizing: border-box; }
            button { background: #25D366; color: white; border: none; padding: 12px 20px; cursor: pointer; font-size: 16px; }
            button:hover { background: #128C7E; }
          </style>
        </head>
        <body>
          <h1>🐾 Pet CRM Setup</h1>
          <p>No business found. Please create one first:</p>
          <form action="/businesses" method="POST">
            <div class="form-group">
              <label>Business Name:</label>
              <input type="text" name="name" required>
            </div>
            <button type="submit">Create Business</button>
          </form>
        </body>
        </html>
      `);
    }
    
    const business = businesses[0];
    const customers = await Customer.listByBusiness(business.id);
    
    // Get customer data with order info
    const customerData = await Promise.all(customers.map(async (customer) => {
      const orders = await Order.listByCustomer(customer.id);
      const lastOrder = orders[0] || null;
      let cycleDays = 30;
      let isDue = false;
      let nextReorderDate = null;
      
      if (lastOrder) {
        cycleDays = await calculateReorderCycle(customer.id, Order);
        isDue = isDueForReorder(lastOrder.date, cycleDays);
        const lastDate = new Date(lastOrder.date);
        nextReorderDate = new Date(lastDate);
        nextReorderDate.setDate(nextReorderDate.getDate() + cycleDays);
      }
      
      return {
        ...customer,
        order_count: orders.length,
        last_order_date: lastOrder?.date || null,
        last_product: lastOrder?.product || null,
        cycle_days: cycleDays,
        is_due: isDue,
        next_reorder_date: nextReorderDate ? formatDate(nextReorderDate) : null
      };
    }));
    
    // Get pending reminders
    const reminders = await Reminder.list();
    const dueCustomers = customerData.filter(c => c.is_due);
    
    // Generate WhatsApp links for due customers
    const dueWithLinks = dueCustomers.map(c => {
      const message = generateReminderMessage(c.pet_name, c.last_product);
      return {
        ...c,
        whatsapp_link: generateWhatsAppLink(c.phone, message)
      };
    });
    
    // Build HTML response
    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>🐾 Pet CRM - Dashboard</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: Arial, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #333; text-align: center; }
    h2 { color: #555; border-bottom: 2px solid #25D366; padding-bottom: 10px; }
    .card { background: white; padding: 20px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input, select { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; }
    button { background: #25D366; color: white; border: none; padding: 12px 20px; cursor: pointer; font-size: 16px; border-radius: 5px; }
    button:hover { background: #128C7E; }
    .btn-secondary { background: #666; }
    .btn-secondary:hover { background: #444; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f9f9f9; }
    .due-badge { background: #ff6b6b; color: white; padding: 3px 8px; border-radius: 3px; font-size: 12px; }
    .alert { background: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin-bottom: 20px; }
    .section { margin-top: 30px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 600px) { .grid { grid-template-columns: 1fr; } }
  </style>
</head>
<body>
  <div class="container">
    <h1>🐾 Pet CRM - ${business.name}</h1>
    ${req.query.msg ? `<div class="alert">${req.query.msg}</div>` : ''}
    
    <div class="card">
      <h2>📋 Daily Actions</h2>
      <form action="/reminders/generate/${business.id}" method="POST">
        <button type="submit">🔔 Generate Today's Reminders</button>
      </form>
    </div>
    
    <div class="grid">
      <div class="card">
        <h2>➕ Add Customer</h2>
        <form action="/customers" method="POST">
          <input type="hidden" name="business_id" value="${business.id}">
          <div class="form-group">
            <label>Owner Name:</label>
            <input type="text" name="name" required>
          </div>
          <div class="form-group">
            <label>Phone:</label>
            <input type="text" name="phone" required>
          </div>
          <div class="form-group">
            <label>Pet Name:</label>
            <input type="text" name="pet_name" required>
          </div>
          <div class="form-group">
            <label>Breed:</label>
            <input type="text" name="breed">
          </div>
          <button type="submit">Add Customer</button>
        </form>
      </div>
      
      <div class="card">
        <h2>📦 Add Order</h2>
        <form action="/orders" method="POST">
          <div class="form-group">
            <label>Customer:</label>
            <select name="customer_id" required>
              <option value="">Select Customer</option>
              ${customerData.map(c => `<option value="${c.id}">${c.name} (${c.pet_name})</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Product:</label>
            <input type="text" name="product" required>
          </div>
          <div class="form-group">
            <label>Date:</label>
            <input type="date" name="date" value="${new Date().toISOString().split('T')[0]}">
          </div>
          <button type="submit">Add Order</button>
        </form>
      </div>
    </div>
    
    <div class="section card">
      <h2>🔔 Customers Due for Reorder (${dueWithLinks.length})</h2>
      ${dueWithLinks.length === 0 ? '<p>No customers due for reorder.</p>' : `
        <table>
          <thead>
            <tr>
              <th>Owner</th>
              <th>Pet</th>
              <th>Last Order</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${dueWithLinks.map(c => `
              <tr>
                <td>${c.name}</td>
                <td>${c.pet_name}</td>
                <td>${c.last_order_date}</td>
                <td>
                  <a href="${c.whatsapp_link}" target="_blank">
                    <button>💬 Send WhatsApp</button>
                  </a>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </div>
    
    <div class="section card">
      <h2>👥 All Customers (${customerData.length})</h2>
      <table>
        <thead>
          <tr>
            <th>Owner</th>
            <th>Pet</th>
            <th>Breed</th>
            <th>Orders</th>
            <th>Last Order</th>
            <th>Next Reorder</th>
          </tr>
        </thead>
        <tbody>
          ${customerData.map(c => `
            <tr>
              <td>${c.name}</td>
              <td>${c.pet_name}</td>
              <td>${c.breed || '-'}</td>
              <td>${c.order_count}</td>
              <td>${c.last_order_date || 'Never'}</td>
              <td>${c.is_due ? '<span class="due-badge">DUE</span>' : (c.next_reorder_date || '-')}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>
    `;
    
    res.send(html);
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).send('Error loading dashboard');
  }
});

module.exports = router;