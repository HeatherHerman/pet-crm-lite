const express = require('express');
const { Customer, Pet, Order, Business, Reminder } = require('../models/queries');
const { calculateReorderCycle, isDueForReorder, formatDate, generateWhatsAppLink, generateReminderMessage } = require('../utils/reminder');

const router = express.Router();

router.get('/dashboard', async (req, res) => {
  try {
    const businesses = await Business.list();
    if (businesses.length === 0) {
      return res.send('<html><head><title>Pet CRM Setup</title></head><body><h1>Create a business first at /businesses</h1></body></html>');
    }
    
    const business = businesses[0];
    const customers = await Customer.listByBusiness(business.id);
    
    const customerData = await Promise.all(customers.map(async (customer) => {
      const pets = await Pet.listByCustomer(customer.id);
      const orders = await Order.listByCustomer(customer.id);
      const lastOrder = orders[0] || null;
      let cycleDays = 30, isDue = false, nextReorderDate = null;
      
      if (lastOrder) {
        cycleDays = await calculateReorderCycle(customer.id, Order);
        isDue = isDueForReorder(lastOrder.date, cycleDays);
        const lastDate = new Date(lastOrder.date);
        nextReorderDate = new Date(lastDate);
        nextReorderDate.setDate(nextReorderDate.getDate() + cycleDays);
      }
      
      return { ...customer, pets, order_count: orders.length, last_order_date: lastOrder?.date || null,
        last_product: lastOrder?.product || null, cycle_days: cycleDays, is_due: isDue,
        next_reorder_date: nextReorderDate ? formatDate(nextReorderDate) : null };
    }));
    
    const dueWithLinks = customerData.filter(c => c.is_due).map(c => {
      const message = generateReminderMessage(c.pets[0]?.name || 'your pet', c.last_product);
      return { ...c, pet_name: c.pets[0]?.name || 'N/A', whatsapp_link: generateWhatsAppLink(c.phone, message) };
    });
    
    const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Pet CRM</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5}
.container{max-width:1000px;margin:0 auto}h1{color:#333;text-align:center}h2{color:#555;border-bottom:2px solid #25D366;padding-bottom:10px}
.card{background:white;padding:20px;border-radius:10px;margin-bottom:20px;box-shadow:0 2px 5px rgba(0,0,0,0.1)}
.form-group{margin-bottom:15px}label{display:block;margin-bottom:5px;font-weight:bold}
input,select,textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:5px}
button{background:#25D366;color:white;border:none;padding:10px 15px;cursor:pointer;font-size:14px;border-radius:5px}
button:hover{background:#128C7E}.btn-danger{background:#dc3545}.btn-small{padding:5px 10px;font-size:12px}
table{width:100%;border-collapse:collapse}th,td{padding:10px;text-align:left;border-bottom:1px solid #ddd}th{background:#f9f9f9}
.alert{background:#d4edda;color:#155724;padding:15px;border-radius:5px;margin-bottom:20px}
.tabs{margin-bottom:20px}.tab{background:#ddd;padding:10px 20px;cursor:pointer;display:inline-block;border-radius:5px 5px 0 0}
.tab.active{background:#25D366;color:white}.tab-content{display:none}.tab-content.active{display:block}
.customer-link{color:#25D366;text-decoration:underline}.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:600px){.grid{grid-template-columns:1fr}}</style></head>
<body><div class="container">
<h1>Pet CRM - ${business.name}</h1>
${req.query.msg ? '<div class="alert">'+req.query.msg+'</div>' : ''}

<div class="tabs"><span class="tab active" onclick="showTab('+"'dashboard'"+')">Dashboard</span>
<span class="tab" onclick="showTab('+"'customers'"+')">Customers</span><span class="tab" onclick="showTab('+"'orders'"+')">Orders</span></div>

<div id="dashboard" class="tab-content active">
<div class="card"><h2>Daily Actions</h2>
<form action="/reminders/generate/${business.id}" method="POST"><button type="submit">Generate Reminders</button></form></div>

<div class="grid">
<div class="card"><h2>Add Customer</h2>
<form action="/customers" method="POST">
<input type="hidden" name="business_id" value="${business.id}">
<div class="form-group"><label>Name:</label><input type="text" name="name" required></div>
<div class="form-group"><label>Phone:</label><input type="text" name="phone" required></div>
<div class="form-group"><label>Email:</label><input type="email" name="email"></div>
<div class="form-group"><label>Address:</label><textarea name="address"></textarea></div>
<button type="submit">Add</button></form></div>

<div class="card"><h2>Add Order</h2>
<form action="/orders" method="POST">
<div class="form-group"><label>Customer:</label>
<select name="customer_id" required><option value="">Select</option>
${customerData.map(c => '<option value="'+c.id+'">'+c.name+'</option>').join('')}
</select></div>
<div class="form-group"><label>Product:</label><input type="text" name="product" required></div>
<div class="form-group"><label>Qty:</label><input type="number" name="quantity" value="1"></div>
<div class="form-group"><label>Price:</label><input type="number" name="price" step="0.01"></div>
<div class="form-group"><label>Date:</label><input type="date" name="date" value="${new Date().toISOString().split('T')[0]}"></div>
<button type="submit">Add</button></form></div>
</div>

<div class="card"><h2>Upload Orders (CSV)</h2>
<form action="/orders/upload" method="POST" enctype="multipart/form-data">
<div class="form-group"><label>File:</label><input type="file" name="file" accept=".csv" required></div>
<p style="font-size:12px;color:#666">Columns: customer_name, phone, product, date</p>
<button type="submit">Upload</button></form></div>

<div class="card"><h2>Due for Reorder (${dueWithLinks.length})</h2>
${dueWithLinks.length === 0 ? '<p>None</p>' : 
'<table><tr><th>Owner</th><th>Pet</th><th>Last Order</th><th>Action</th></tr>' +
dueWithLinks.map(c => '<tr><td><a href="/dashboard/customers/'+c.id+'" class="customer-link">'+c.name+'</a></td><td>'+c.pet_name+'</td><td>'+c.last_order_date+'</td><td><a href="'+c.whatsapp_link+'" target="_blank"><button class="btn-small">WhatsApp</button></a></td></tr>').join('') +
'</table>'}
</div></div>

<div id="customers" class="tab-content">
<div class="card"><h2>Customers (${customers.length})</h2>
<table><tr><th>Name</th><th>Phone</th><th>Pets</th><th>Orders</th><th>Actions</th></tr>
${customerData.map(c => '<tr><td><a href="/dashboard/customers/'+c.id+'" class="customer-link">'+c.name+'</a></td><td>'+c.phone+'</td><td>'+c.pets.length+'</td><td>'+c.order_count+'</td><td><a href="/dashboard/customers/'+c.id+'"><button class="btn-small">View</button></a> <button class="btn-small btn-danger" onclick="deleteCust('+c.id+')">Delete</button></td></tr>').join('')}
</table></div></div>

<div id="orders" class="tab-content">
<div class="card"><h2>All Orders</h2>
<table><tr><th>Date</th><th>Customer</th><th>Product</th><th>Qty</th><th>Price</th><th></th></tr>
${customerData.flatMap(c => (c.orders||[]).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,50).map(o => '<tr><td>'+o.date+'</td><td>'+(customerData.find(x=>x.id===o.customer_id)?.name||'Unknown')+'</td><td>'+o.product+'</td><td>'+(o.quantity||1)+'</td><td>'+(o.price?'Rs'+o.price:'-')+'</td><td><button class="btn-small btn-danger" onclick="deleteOrder('+o.id+')">X</button></td></tr>')).join('')}
</table></div></div>
</div>

<script>function showTab(t){document.querySelectorAll('.tab-content').forEach(x=>x.classList.remove('active'));document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));document.getElementById(t).classList.add('active');event.target.classList.add('active')}
function deleteCust(id){if(confirm('Delete customer?'))fetch('/customers/'+id,{method:'DELETE'}).then(r=>r.json()).then(d=>location.href='/dashboard?msg=Deleted').catch(e=>alert('Error'))}
function deleteOrder(id){if(confirm('Delete order?'))fetch('/orders/'+id,{method:'DELETE'}).then(r=>r.json()).then(d=>location.href='/dashboard?msg=Deleted').catch(e=>alert('Error'))}
</script></body></html>`;
    res.send(html);
  } catch (err) { console.error('Dashboard:', err); res.status(500).send('Error'); }
});

router.get('/dashboard/customers/:id', async (req, res) => {
  try {
    const customer = await Customer.getById(req.params.id);
    if (!customer) return res.redirect('/dashboard?error=Not+found');
    
    const pets = await Pet.listByCustomer(customer.id);
    const orders = await Order.listByCustomer(customer.id);
    const reminders = await Reminder.getByCustomer(customer.id);
    
    const topProducts = Object.entries(orders.reduce((a,o)=>(a[o.product]=(a[o.product]||0)+1,a),{})).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([p,c])=>({p,c}));
    
    const html = `<!DOCTYPE html>
<html><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${customer.name}</title>
<style>*{box-sizing:border-box}body{font-family:Arial,sans-serif;margin:0;padding:20px;background:#f5f5f5}
.container{max-width:900px;margin:0 auto}.card{background:white;padding:20px;border-radius:10px;margin-bottom:20px;box-shadow:0 2px 5px}
h1{color:#333}h2{color:#555;border-bottom:2px solid #25D366;padding-bottom:10px}.form-group{margin-bottom:15px}
label{display:block;margin-bottom:5px;font-weight:bold}input,textarea{width:100%;padding:10px;border:1px solid #ddd;border-radius:5px}
textarea{height:80px}button{background:#25D366;color:white;border:none;padding:10px 20px;cursor:pointer;border-radius:5px}
button:hover{background:#128C7E}.btn-danger{background:#dc3545}.btn-small{padding:5px 10px;font-size:12px}
table{width:100%;border-collapse:collapse}th,td{padding:10px;border-bottom:1px solid #ddd}th{background:#f9f9f9}
.back-link{display:inline-block;margin-bottom:20px;color:#25D366;text-decoration:none}.alert{background:#d4edda;padding:15px;border-radius:5px;margin-bottom:20px}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}@media(max-width:600px){.grid{1fr}}</style></head>
<body><div class="container">
<a href="/dashboard" class="back-link">Back</a><h1>${customer.name}</h1>
${req.query.msg ? '<div class="alert">'+req.query.msg+'</div>' : ''}

<div class="grid">
<div class="card"><h2>Edit Info</h2>
<form action="/customers/${customer.id}?_method=PUT" method="POST">
<div class="form-group"><label>Name:</label><input type="text" name="name" value="${customer.name}" required></div>
<div class="form-group"><label>Phone:</label><input type="text" name="phone" value="${customer.phone}" required></div>
<div class="form-group"><label>Email:</label><input type="email" name="email" value="${customer.email||''}"></div>
<div class="form-group"><label>Address:</label><textarea name="address">${customer.address||''}</textarea></div>
<div class="form-group"><label>Notes:</label><textarea name="notes">${customer.notes||''}</textarea></div>
<button type="submit">Save</button></form></div>

<div class="card"><h2>Add Pet</h2>
<form action="/customers/${customer.id}/pets" method="POST">
<div class="form-group"><label>Name:</label><input type="text" name="name" required></div>
<div class="form-group"><label>Breed:</label><input type="text" name="breed"></div>
<div class="form-group"><label>Birthdate:</label><input type="date" name="birthdate"></div>
<div class="form-group"><label>Notes:</label><textarea name="notes"></textarea></div>
<button type="submit">Add Pet</button></form>

<h3>Pets (${pets.length})</h3>
${pets.length?('<table><tr><th>Name</th><th>Breed</th><th>Birth</th><th></th></tr>'+
pets.map(p=>'<tr><td>'+p.name+'</td><td>'+(p.breed||'-')+'</td><td>'+(p.birthdate||'-')+'</td><td><button class="btn-small btn-danger" onclick="delPet('+p.id+')">X</button></td></tr>').join('')+'</table>'):'<p>No pets</p>'}
</div></div>

<div class="card"><h2>Orders (${orders.length})</h2>
${orders.length?('<table><tr><th>Date</th><th>Product</th><th>Qty</th><th>Price</th><th></th></tr>'+
orders.map(o=>'<tr><td>'+o.date+'</td><td>'+o.product+'</td><td>'+(o.quantity||1)+'</td><td>'+(o.price?'Rs'+o.price:'-')+'</td><td><button class="btn-small btn-danger" onclick="delOrd('+o.id+')">X</button></td></tr>').join('')+'</table>'):'<p>No orders</p>'}
</div>

<div class="card"><h2>Top Products</h2>
${topProducts.length?('<table><tr><th>Product</th><th>Times</th></tr>'+
topProducts.map(p=>'<tr><td>'+p.p+'</td><td>'+p.c+'</td></tr>').join('')+'</table>'):'<p>No data</p>'}
</div>

<div class="card"><h2>Reminders</h2>
${reminders.length?('<table><tr><th>Due</th><th>Status</th></tr>'+
reminders.map(r=>'<tr><td>'+r.due_date+'</td><td>'+r.status+'</td></tr>').join('')+'</table>'):'<p>No reminders</p>'}
</div>
</div>

<script>function delPet(pid){if(confirm('Delete pet?'))fetch('/customers/pets/'+pid,{method:'DELETE'}).then(r=>r.json()).then(d=>location.href='/dashboard/customers/${customer.id}?msg=Pet+deleted').catch(e=>alert('Error'))}
function delOrd(oid){if(confirm('Delete order?'))fetch('/orders/'+oid,{method:'DELETE'}).then(r=>r.json()).then(d=>location.href='/dashboard/customers/${customer.id}?msg=Order+deleted').catch(e=>alert('Error'))}</script>
</body></html>`;
    res.send(html);
  } catch (err) { console.error('Customer detail:', err); res.status(500).send('Error'); }
});

module.exports = router;