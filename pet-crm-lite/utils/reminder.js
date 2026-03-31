// Reminder calculation utilities

// Calculate days between two dates
function daysBetween(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  const diffTime = Math.abs(d2 - d1);
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

// Calculate reorder cycle for a customer based on their orders
async function calculateReorderCycle(customerId, Order) {
  const orders = await Order.getAllByCustomer(customerId);
  
  if (orders.length < 2) {
    return 30; // Default 30 days if insufficient data
  }
  
  // Calculate average gap between orders
  let totalDays = 0;
  for (let i = 1; i < orders.length; i++) {
    totalDays += daysBetween(orders[i - 1].date, orders[i].date);
  }
  
  const avgDays = Math.round(totalDays / (orders.length - 1));
  return avgDays > 0 ? avgDays : 30;
}

// Check if a customer is due for a reorder
function isDueForReorder(lastOrderDate, cycleDays) {
  const lastOrder = new Date(lastOrderDate);
  const today = new Date();
  const dueDate = new Date(lastOrder);
  dueDate.setDate(dueDate.getDate() + cycleDays);
  
  return today > dueDate;
}

// Format date to YYYY-MM-DD
function formatDate(date) {
  return date.toISOString().split('T')[0];
}

// Generate WhatsApp message link
function generateWhatsAppLink(phone, message) {
  // Remove any non-digit characters from phone
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

// Generate reminder message
function generateReminderMessage(petName, product) {
  return `Hi! Time to restock for ${petName}? Same as last time?`;
}

module.exports = {
  daysBetween,
  calculateReorderCycle,
  isDueForReorder,
  formatDate,
  generateWhatsAppLink,
  generateReminderMessage
};