/**
 * Datasets the SQL editor can query. Each lives in its own Postgres schema.
 * - "shop" is written for Schemata and built in: every interview question runs on it.
 * - The others are open-source sample databases fetched from GitHub on first use
 *   (cached for offline by the service worker), so their data is never bundled here.
 */

export interface Dataset {
  id: string;
  name: string;
  blurb: string;
  /** Raw SQL file to fetch; absent for the built-in dataset. */
  url?: string;
  repo?: string;
  license?: string;
  /** Shown before a dataset is loaded, so you know what you'll get. */
  tables: string[];
}

export const DATASETS: Dataset[] = [
  {
    id: "shop",
    name: "Shop (built in)",
    blurb: "An online shop: customers, orders, products, employees and logins. All interview questions use it.",
    tables: ["customers", "orders", "order_items", "products", "employees", "departments", "logins"],
  },
  {
    id: "chinook",
    name: "Chinook",
    blurb: "A digital music store: artists, albums, tracks, invoices, customers and support reps.",
    url: "https://raw.githubusercontent.com/lerocha/chinook-database/master/ChinookDatabase/DataSources/Chinook_PostgreSql.sql",
    repo: "lerocha/chinook-database",
    license: "MIT",
    tables: ["artist", "album", "track", "genre", "invoice", "invoice_line", "customer", "employee", "playlist"],
  },
  {
    id: "northwind",
    name: "Northwind",
    blurb: "Microsoft's classic trading company: orders, suppliers, shippers, territories.",
    url: "https://raw.githubusercontent.com/pthom/northwind_psql/master/northwind.sql",
    repo: "pthom/northwind_psql",
    license: "Ms-PL",
    tables: ["orders", "order_details", "products", "customers", "employees", "suppliers", "shippers", "categories"],
  },
];

/**
 * Makes a downloaded script safe to run inside one schema of the in-browser Postgres:
 * drops database switching (CREATE/DROP DATABASE, \c) and session settings.
 */
export function cleanScript(sql: string): string {
  return sql
    .split(/\r?\n/)
    .filter((line) => !/^\s*(\\c\b|(CREATE|DROP)\s+DATABASE\b|SET\s+\w+\s*=|SELECT\s+pg_catalog\.set_config)/i.test(line))
    .join("\n");
}

/** The built-in "shop" schema. Data is generated with fixed formulas, so it is the same on every device. */
export const SHOP_SQL = /* sql */ `
CREATE SCHEMA shop;
SET search_path TO shop;

CREATE TABLE departments (
  id       INT PRIMARY KEY,
  name     TEXT NOT NULL,
  location TEXT NOT NULL
);

CREATE TABLE employees (
  id            INT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT,
  department_id INT REFERENCES departments(id),
  manager_id    INT REFERENCES employees(id),
  salary        INT NOT NULL,
  hire_date     DATE NOT NULL
);

CREATE TABLE customers (
  id          INT PRIMARY KEY,
  name        TEXT NOT NULL,
  email       TEXT NOT NULL,
  city        TEXT NOT NULL,
  country     TEXT NOT NULL,
  signup_date DATE NOT NULL,
  referred_by INT REFERENCES customers(id)
);

CREATE TABLE products (
  id       INT PRIMARY KEY,
  name     TEXT NOT NULL,
  category TEXT NOT NULL,
  price    NUMERIC(10,2) NOT NULL,
  stock    INT NOT NULL
);

CREATE TABLE orders (
  id          INT PRIMARY KEY,
  customer_id INT NOT NULL REFERENCES customers(id),
  order_date  DATE NOT NULL,
  status      TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'cancelled'))
);

CREATE TABLE order_items (
  order_id   INT REFERENCES orders(id),
  product_id INT REFERENCES products(id),
  quantity   INT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE logins (
  user_id    INT NOT NULL REFERENCES customers(id),
  login_date DATE NOT NULL,
  PRIMARY KEY (user_id, login_date)
);

INSERT INTO departments VALUES
  (1, 'Engineering', 'Bengaluru'),
  (2, 'Sales', 'Mumbai'),
  (3, 'Marketing', 'Delhi'),
  (4, 'Finance', 'Mumbai'),
  (5, 'Support', 'Pune'),
  (6, 'Research', 'Hyderabad');  -- no employees: for LEFT JOIN questions

INSERT INTO employees VALUES
  (1,  'Asha Rao',       'asha@shop.dev',    1, NULL, 250000, '2018-02-01'),
  (2,  'Vikram Shah',    'vikram@shop.dev',  1, 1,    180000, '2019-04-15'),
  (3,  'Meera Iyer',     'meera@shop.dev',   1, 2,    150000, '2020-07-01'),
  (4,  'Rohan Das',      'rohan@shop.dev',   1, 2,    150000, '2021-01-10'),
  (5,  'Kabir Singh',    NULL,               1, 2,    120000, '2022-03-21'),
  (6,  'Nisha Kapoor',   'nisha@shop.dev',   1, 3,     95000, '2023-06-05'),
  (7,  'Arjun Menon',    'arjun@shop.dev',   2, 1,    170000, '2018-09-12'),
  (8,  'Priya Nair',     'priya@shop.dev',   2, 7,    110000, '2020-11-30'),
  (9,  'Sameer Khan',    'sameer@shop.dev',  2, 7,    110000, '2021-08-17'),
  (10, 'Divya Pillai',   NULL,               2, 8,     70000, '2023-02-14'),
  (11, 'Tara Bose',      'tara@shop.dev',    3, 1,    140000, '2019-01-07'),
  (12, 'Ishaan Gupta',   'ishaan@shop.dev',  3, 11,    90000, '2021-05-25'),
  (13, 'Zoya Ahmed',     'zoya@shop.dev',    3, 11,    85000, '2022-10-03'),
  (14, 'Karan Malhotra', 'karan@shop.dev',   4, 1,    160000, '2018-12-01'),
  (15, 'Neha Joshi',     'neha@shop.dev',    4, 14,   125000, '2020-03-16'),
  (16, 'Aditya Kulkarni','aditya@shop.dev',  4, 14,   125000, '2024-01-08'),
  (17, 'Pooja Reddy',    'pooja@shop.dev',   5, 1,    100000, '2019-06-19'),
  (18, 'Manish Verma',   'manish@shop.dev',  5, 17,    60000, '2022-07-11'),
  (19, 'Sana Qureshi',   'sana@shop.dev',    5, 17,    60000, '2023-09-29'),
  (20, 'Rahul Jain',     NULL,               5, 17,    55000, '2024-04-02'),
  (21, 'Ananya Ghosh',   'ananya@shop.dev',  NULL, 1,  130000, '2024-08-20');  -- no department

INSERT INTO products VALUES
  (1,  'Mechanical Keyboard', 'Electronics', 4999.00, 120),
  (2,  'Wireless Mouse',      'Electronics', 1299.00, 340),
  (3,  '27" Monitor',         'Electronics', 18999.00, 45),
  (4,  'USB-C Hub',           'Electronics', 2499.00, 0),
  (5,  'Noise-cancelling Headphones', 'Electronics', 14999.00, 60),
  (6,  'Designing Data-Intensive Applications', 'Books', 1899.00, 80),
  (7,  'SQL Performance Explained', 'Books', 1499.00, 25),
  (8,  'Database Internals',  'Books', 2199.00, 0),
  (9,  'Clean Code',          'Books', 999.00, 150),
  (10, 'Standing Desk',       'Furniture', 24999.00, 12),
  (11, 'Ergonomic Chair',     'Furniture', 15999.00, 30),
  (12, 'Desk Lamp',           'Furniture', 1999.00, 75),
  (13, 'Coffee Beans 1kg',    'Grocery', 899.00, 500),
  (14, 'Green Tea 100 bags',  'Grocery', 399.00, 220),
  (15, 'Protein Bars x12',    'Grocery', 1199.00, 0);

-- 200 customers, plus 3 that repeat an earlier email (for de-duplication questions).
INSERT INTO customers
SELECT i,
       'Customer ' || i,
       'customer' || i || '@mail.dev',
       (ARRAY['Mumbai','Delhi','Bengaluru','Pune','Chennai','Hyderabad','Kolkata','Jaipur'])[1 + i % 8],
       CASE WHEN i % 10 = 0 THEN 'UAE' WHEN i % 13 = 0 THEN 'Singapore' ELSE 'India' END,
       DATE '2024-01-01' + (i * 3 % 540),
       CASE WHEN i % 5 = 0 AND i > 5 THEN i / 5 END
FROM generate_series(1, 200) AS i;

INSERT INTO customers VALUES
  (201, 'Customer 10 (dup)', 'customer10@mail.dev', 'Mumbai', 'UAE', '2025-05-01', NULL),
  (202, 'Customer 20 (dup)', 'customer20@mail.dev', 'Delhi', 'UAE', '2025-05-02', NULL),
  (203, 'Customer 30 (dup)', 'customer30@mail.dev', 'Pune', 'UAE', '2025-05-03', NULL);

-- 1,500 orders in 2025. Customers 181-203 never order (for anti-join questions).
INSERT INTO orders
SELECT i,
       1 + (i * 37 % 180),
       DATE '2025-01-01' + (i * 13 % 365),
       CASE i % 10 WHEN 0 THEN 'cancelled' WHEN 1 THEN 'pending' ELSE 'delivered' END
FROM generate_series(1, 1500) AS i;

-- 1 to 3 different products per order, at the product's price.
INSERT INTO order_items
SELECT o.id, p.id, 1 + (o.id + k) % 4, p.price
FROM orders o
CROSS JOIN LATERAL generate_series(1, 1 + o.id % 3) AS k
JOIN products p ON p.id = 1 + (o.id * 31 + k * 2) % 15;

-- Daily logins for customers 1-50 over March-April 2025, with streaks and gaps.
INSERT INTO logins
SELECT u, DATE '2025-03-01' + d
FROM generate_series(1, 50) AS u
CROSS JOIN generate_series(0, 60) AS d
WHERE (d * u + u * u) % 7 < 4 OR (u % 10 = 3 AND d BETWEEN 10 AND 24);

CREATE INDEX orders_customer_idx ON orders (customer_id);
CREATE INDEX orders_date_idx ON orders (order_date);
ANALYZE;
`;
