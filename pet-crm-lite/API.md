# Pet CRM Lite - API Endpoints

## API Endpoints

### 1. Businesses
- **POST /businesses** - Create a business
- **GET /businesses** - List all businesses

### 2. Customers
- **POST /customers** - Create a customer
- **GET /customers/:business_id** - List customers for a business

### 3. Orders
- **POST /orders** - Create an order

### 4. Reminders
- **POST /reminders/generate/:business_id** - Generate reminders for a business
- **GET /reminders** - List pending reminders
- **GET /reminders/whatsapp/:customer_id** - Get WhatsApp link for a customer

---

## Sample curl Commands

### Create Business
```bash
curl -X POST http://localhost:3000/businesses \
  -H "Content-Type: application/json" \
  -d '{"name": "My Pet Shop"}'
```

### List Businesses
```bash
curl http://localhost:3000/businesses
```

### Create Customer
```bash
curl -X POST http://localhost:3000/customers \
  -H "Content-Type: application/json" \
  -d '{"business_id": 1, "name": "John Doe", "phone": "9876543210", "pet_name": "Max", "breed": "Golden Retriever"}'
```

### List Customers for Business
```bash
curl http://localhost:3000/customers/1
```

### Create Order
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"customer_id": 1, "product": "Dog Food 5kg", "date": "2026-03-01"}'
```

### Generate Reminders
```bash
curl -X POST http://localhost:3000/reminders/generate/1
```

### Get Pending Reminders
```bash
curl http://localhost:3000/reminders
```

### Get WhatsApp Link
```bash
curl http://localhost:3000/reminders/whatsapp/1
```

---

## Test Data Summary

- 1 Business: "Paws & Claws Pet Store"
- 5 Customers:
  - Ravi Kumar (Bruno - Golden Retriever)
  - Sunita Sharma (Max - German Shepherd)
  - Anil Patel (Charlie - Labrador)
  - Priya Singh (Bella - Poodle)
  - Vikram Mehta (Rocky - Beagle)
- 7 Orders created
- 5 pending reminders generated

---

## WhatsApp Link Example

For Ravi Kumar (Bruno):
https://wa.me/9876543210?text=Hi!%20Time%20to%20restock%20for%20Bruno%3F%20Same%20as%20last%20time%3F