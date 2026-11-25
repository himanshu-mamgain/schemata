import type { EcoRef } from "../ecosystem";
import { DESIGN_QUESTIONS, type DesignQuestion } from "./design";

export type { DesignQuestion };

export type Level = "easy" | "medium" | "hard";

interface Base {
  id: string;
  title: string;
  level: Level;
  /** Roadmap stage this question practises. */
  stage: string;
  tags: string[];
  related?: EcoRef[];
}

/** Write a query on the built-in shop dataset; it is checked against the solution's result. */
export interface SqlQuestion extends Base {
  kind: "sql";
  prompt: string;
  hint: string;
  solution: string;
  /** True when the question asks for a specific row order. */
  ordered: boolean;
  explanation: string;
}

/** A concept question: think, then reveal the model answer. */
export interface TheoryQuestion extends Base {
  kind: "theory";
  prompt: string;
  answer: string;
}

export type Question = SqlQuestion | TheoryQuestion | DesignQuestion;

export const QUESTIONS: Question[] = [
  // ---------- Easy ----------
  {
    kind: "sql", id: "high-earners", title: "Employees earning over 1.5 lakh", level: "easy", stage: "basics", tags: ["WHERE", "ORDER BY"],
    prompt: "List the employees who earn more than 150000 (150000 itself doesn't count). Return two columns: the employee's `name` and `salary`. Sort by salary, highest first.",
    hint: "Filter with WHERE, sort with ORDER BY … DESC. Strictly more than: 150000 itself is excluded.",
    solution: "SELECT name, salary\nFROM employees\nWHERE salary > 150000\nORDER BY salary DESC;",
    ordered: true,
    explanation: "WHERE filters rows before anything else happens; ORDER BY runs last. Ties keep any order, which is why the checker only compares the salary order here.",
  },
  {
    kind: "sql", id: "missing-email", title: "Employees with no email", level: "easy", stage: "basics", tags: ["NULL"],
    prompt: "Some employees have no email address: their `email` is NULL (no value at all). Return one column: the `name` of each of those employees. Any row order.",
    hint: "`email = NULL` is never true. NULL needs a special operator.",
    solution: "SELECT name FROM employees WHERE email IS NULL;",
    ordered: false,
    explanation: "Any comparison with NULL yields UNKNOWN, which WHERE treats as false. Use IS NULL / IS NOT NULL. This is the most common SQL trap in interviews.",
  },
  {
    kind: "sql", id: "out-of-stock", title: "Out-of-stock products by category", level: "easy", stage: "basics", tags: ["WHERE", "ORDER BY"],
    prompt: "A product is out of stock when its `stock` is 0. Return two columns for each one: `category`, then `name`. Sort by category from A to Z, and inside each category by name from A to Z.",
    hint: "Two sort keys: ORDER BY a, b.",
    solution: "SELECT category, name FROM products WHERE stock = 0 ORDER BY category, name;",
    ordered: true,
    explanation: "ORDER BY with several columns sorts by the first, then breaks ties with the next.",
  },
  {
    kind: "sql", id: "customers-per-city", title: "Customers per city", level: "easy", stage: "aggregation", tags: ["GROUP BY", "COUNT"],
    prompt: "Count the customers in each city. Return two columns: the `city` and how many customers live there. Sort by that count, highest first; when two cities have the same count, put them in alphabetical order.",
    hint: "GROUP BY city, then COUNT(*).",
    solution: "SELECT city, COUNT(*) AS customers\nFROM customers\nGROUP BY city\nORDER BY customers DESC, city;",
    ordered: true,
    explanation: "GROUP BY collapses rows into one per group; aggregates like COUNT run per group. Every selected column must be grouped or aggregated.",
  },
  {
    kind: "sql", id: "big-departments", title: "Departments with 3+ people", level: "easy", stage: "aggregation", tags: ["HAVING"],
    prompt: "Count the employees in each department, and keep only the departments with 3 or more people. Return two columns: the `department_id` and the number of employees in it. Employees whose `department_id` is NULL belong to no department, so leave them out. Any row order.",
    hint: "WHERE filters rows; HAVING filters groups.",
    solution: "SELECT department_id, COUNT(*) AS headcount\nFROM employees\nWHERE department_id IS NOT NULL\nGROUP BY department_id\nHAVING COUNT(*) >= 3;",
    ordered: false,
    explanation: "HAVING runs after grouping, so it can use aggregates. WHERE runs before, so it can't. Logical order: FROM → WHERE → GROUP BY → HAVING → SELECT → ORDER BY → LIMIT.",
  },
  {
    kind: "sql", id: "employee-department", title: "Employee with department name", level: "easy", stage: "joins", tags: ["INNER JOIN"],
    prompt: "Return two columns: each employee's `name`, and the `name` of their department (from the `departments` table). Leave out employees who have no department (their `department_id` is NULL). Any row order.",
    hint: "Join employees to departments on department_id = id.",
    solution: "SELECT e.name, d.name AS department\nFROM employees e\nJOIN departments d ON d.id = e.department_id;",
    ordered: false,
    explanation: "An INNER JOIN keeps only rows that match on both sides, so Ananya (no department) disappears. That's exactly what was asked here.",
  },
  // ---------- Medium ----------
  {
    kind: "sql", id: "empty-departments", title: "Departments with no employees", level: "medium", stage: "joins", tags: ["LEFT JOIN", "anti-join"],
    prompt: "Some departments have nobody in them: no employee's `department_id` points at them. Return one column: the `name` of each of those departments. Any row order.",
    hint: "LEFT JOIN, then keep rows where the right side is NULL. Or NOT EXISTS.",
    solution: "SELECT d.name\nFROM departments d\nWHERE NOT EXISTS (SELECT 1 FROM employees e WHERE e.department_id = d.id);",
    ordered: false,
    explanation: "This is an anti-join. NOT EXISTS is the safest form: NOT IN breaks as soon as the subquery returns a NULL (then nothing matches).",
  },
  {
    kind: "sql", id: "never-ordered", title: "Customers who never ordered", level: "medium", stage: "joins", tags: ["LEFT JOIN", "anti-join"],
    prompt: "Return two columns, `id` and `name`, for every customer who has no rows at all in `orders` (an order of any status counts as an order). Any row order.",
    hint: "LEFT JOIN orders and keep the customers whose order side is NULL.",
    solution: "SELECT c.id, c.name\nFROM customers c\nLEFT JOIN orders o ON o.customer_id = c.id\nWHERE o.id IS NULL;",
    ordered: false,
    explanation: "Classic LeetCode-style anti-join. The WHERE must test a column that can only be NULL when there was no match, like the primary key.",
  },
  {
    kind: "sql", id: "manager-names", title: "Employee and manager", level: "medium", stage: "joins", tags: ["self join"],
    prompt: "Each employee's `manager_id` holds the `id` of their manager, who is also an employee. Return two columns for every employee: the employee's name, then their manager's name. The CEO has no manager (`manager_id` is NULL): keep her, with NULL as the manager. Any row order.",
    hint: "Join employees to itself, with a LEFT JOIN so the CEO stays.",
    solution: "SELECT e.name AS employee, m.name AS manager\nFROM employees e\nLEFT JOIN employees m ON m.id = e.manager_id;",
    ordered: false,
    explanation: "A self join treats one table as two, using aliases. Hierarchies (managers, referrals, categories) are the classic case.",
  },
  {
    kind: "sql", id: "earn-more-than-manager", title: "Earns more than their manager", level: "medium", stage: "joins", tags: ["self join"],
    prompt: "Return one column: the `name` of every employee whose `salary` is strictly greater than their own manager's salary. Employees with no manager are skipped. Any row order.",
    hint: "Self join, then compare the two salaries.",
    solution: "SELECT e.name\nFROM employees e\nJOIN employees m ON m.id = e.manager_id\nWHERE e.salary > m.salary;",
    ordered: false,
    explanation: "In this data no one does, so the right answer is an empty result. An empty result is a valid answer: don't force rows.",
  },
  {
    kind: "sql", id: "second-highest-salary", title: "Second highest salary", level: "medium", stage: "subqueries", tags: ["subquery", "DISTINCT"],
    prompt: "Find the second highest **distinct** salary: if two people share the top salary, the second highest is the next lower amount. Return one row with one column holding that salary. (If there were no second salary, the answer would be one row holding NULL.)",
    hint: "The highest salary below the maximum. Or DISTINCT … ORDER BY … OFFSET 1.",
    solution: "SELECT MAX(salary) AS second_highest\nFROM employees\nWHERE salary < (SELECT MAX(salary) FROM employees);",
    ordered: false,
    explanation: "Watch out for ties: 'second highest' means the second distinct value. The MAX-below-MAX form also returns NULL (not zero rows) when there is no second value, which interviewers like.",
  },
  {
    kind: "sql", id: "nth-salary-dense-rank", title: "Third highest salary per department", level: "medium", stage: "windows", tags: ["DENSE_RANK", "PARTITION BY"],
    prompt: "Inside each department, rank the distinct salaries from highest to lowest; equal salaries share a place (salaries 900, 800, 800, 700 are 1st, 2nd, 2nd, 3rd). Return three columns, `department_id`, `name` and `salary`, for every employee whose salary is in 3rd place in their department. A department with fewer than 3 distinct salaries returns nothing. Leave out employees with no department. Any row order.",
    hint: "DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC), then filter rank = 3 in an outer query.",
    solution: "SELECT department_id, name, salary\nFROM (\n  SELECT department_id, name, salary,\n         DENSE_RANK() OVER (PARTITION BY department_id ORDER BY salary DESC) AS r\n  FROM employees\n  WHERE department_id IS NOT NULL\n) ranked\nWHERE r = 3;",
    ordered: false,
    explanation: "ROW_NUMBER gives unique numbers (ties broken arbitrarily), RANK skips after ties (1,1,3), DENSE_RANK doesn't (1,1,2). 'Nth highest distinct' means DENSE_RANK. You can't filter a window function in WHERE, hence the subquery.",
  },
  {
    kind: "sql", id: "revenue-by-category", title: "Revenue by category", level: "medium", stage: "aggregation", tags: ["JOIN", "SUM"],
    prompt: "Revenue is `quantity × unit_price` on each order line (`order_items`), added up over delivered orders only (`orders.status = 'delivered'`). Return two columns: each product `category` and its revenue. Highest revenue first.",
    hint: "Join orders → order_items → products, filter on status, group by category.",
    solution: "SELECT p.category, SUM(oi.quantity * oi.unit_price) AS revenue\nFROM orders o\nJOIN order_items oi ON oi.order_id = o.id\nJOIN products p ON p.id = oi.product_id\nWHERE o.status = 'delivered'\nGROUP BY p.category\nORDER BY revenue DESC;",
    ordered: true,
    explanation: "Filter before you aggregate. Use the price stored on the order line, not the current product price: prices change, history shouldn't.",
  },
  {
    kind: "sql", id: "duplicate-emails", title: "Find duplicate emails", level: "medium", stage: "aggregation", tags: ["GROUP BY", "HAVING"],
    prompt: "Some customers share an email address. Return two columns: each `email` that more than one customer uses, and how many customers use it. Any row order.",
    hint: "GROUP BY email HAVING COUNT(*) > 1.",
    solution: "SELECT email, COUNT(*) AS copies\nFROM customers\nGROUP BY email\nHAVING COUNT(*) > 1;",
    ordered: false,
    explanation: "The first step of any de-duplication. A UNIQUE constraint would have prevented this. Data quality belongs in the schema.",
  },
  {
    kind: "sql", id: "keep-first-duplicate", title: "Keep the oldest duplicate", level: "medium", stage: "windows", tags: ["ROW_NUMBER", "dedupe"],
    prompt: "When several customers share an email, you keep the one with the lowest `id` and would delete the others. Return two columns, `email` and the `id` to keep, with one row for every distinct email (emails used only once included). Any row order.",
    hint: "ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) = 1. Or simply MIN(id) … GROUP BY email.",
    solution: "SELECT email, id\nFROM (\n  SELECT email, id, ROW_NUMBER() OVER (PARTITION BY email ORDER BY id) AS rn\n  FROM customers\n) t\nWHERE rn = 1;",
    ordered: false,
    explanation: "To actually delete: DELETE FROM customers WHERE id IN (… rn > 1 …). The ROW_NUMBER form generalises to 'keep the latest row per key', which MIN can't do when you need the whole row.",
  },
  {
    kind: "sql", id: "monthly-orders", title: "Orders per month", level: "medium", stage: "aggregation", tags: ["date_trunc", "GROUP BY"],
    prompt: "Count the orders placed in each month (every status counts; all orders are in 2025). Return two columns: the month, written as the date of its first day (2025-01-01 for January), and the number of orders placed in it. Sort by month, January first.",
    hint: "date_trunc('month', order_date).",
    solution: "SELECT date_trunc('month', order_date)::date AS month, COUNT(*) AS orders\nFROM orders\nGROUP BY 1\nORDER BY 1;",
    ordered: true,
    explanation: "date_trunc buckets timestamps. GROUP BY 1 refers to the first selected column, handy but fragile in production code.",
  },
  {
    kind: "sql", id: "top-customer-per-city", title: "Top customer per city", level: "medium", stage: "windows", tags: ["top-N per group", "RANK"],
    prompt: "A customer's total spent is `quantity × unit_price` added up over all the lines of their delivered orders. For each city, find the customer who spent the most; if several are tied, return all of them. Return three columns: the `city`, the customer's `id` and their total spent. Any row order.",
    hint: "Aggregate spend per customer first (a CTE), then RANK() per city.",
    solution: "WITH spend AS (\n  SELECT c.city, c.id, SUM(oi.quantity * oi.unit_price) AS spent\n  FROM customers c\n  JOIN orders o ON o.customer_id = c.id AND o.status = 'delivered'\n  JOIN order_items oi ON oi.order_id = o.id\n  GROUP BY c.city, c.id\n)\nSELECT city, id, spent\nFROM (SELECT *, RANK() OVER (PARTITION BY city ORDER BY spent DESC) AS r FROM spend) t\nWHERE r = 1;",
    ordered: false,
    explanation: "'Top N per group' is the most asked window-function question. RANK keeps ties; ROW_NUMBER would pick one arbitrarily.",
  },
  // ---------- Hard ----------
  {
    kind: "sql", id: "running-total", title: "Running revenue total", level: "hard", stage: "windows", tags: ["SUM OVER", "running total"],
    prompt: "A day's revenue is `quantity × unit_price` added up over the delivered orders placed that day. For each day of January 2025 that has delivered orders, return three columns: the date, that day's revenue, and the running total (all revenue from 1 January up to and including that day). Sort by date.",
    hint: "Aggregate per day in a CTE, then SUM(revenue) OVER (ORDER BY day).",
    solution: "WITH daily AS (\n  SELECT o.order_date AS day, SUM(oi.quantity * oi.unit_price) AS revenue\n  FROM orders o JOIN order_items oi ON oi.order_id = o.id\n  WHERE o.status = 'delivered' AND o.order_date < DATE '2025-02-01'\n  GROUP BY o.order_date\n)\nSELECT day, revenue, SUM(revenue) OVER (ORDER BY day) AS running_total\nFROM daily\nORDER BY day;",
    ordered: true,
    explanation: "A window with ORDER BY and no frame clause defaults to RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW, which is a running total. Aggregate first, then window.",
  },
  {
    kind: "sql", id: "month-over-month", title: "Month-over-month growth", level: "hard", stage: "windows", tags: ["LAG", "growth"],
    prompt: "Count the orders in each month of 2025 (every status counts). Return three columns: the month (the date of its first day), its order count, and the change from the previous month in percent: (this month − last month) ÷ last month × 100, rounded to 1 decimal place. January has no previous month, so its change is NULL. Sort by month, January first.",
    hint: "LAG(count) OVER (ORDER BY month). Watch integer division.",
    solution: "WITH m AS (\n  SELECT date_trunc('month', order_date)::date AS month, COUNT(*) AS orders\n  FROM orders GROUP BY 1\n)\nSELECT month, orders,\n       ROUND(100.0 * (orders - LAG(orders) OVER (ORDER BY month)) / LAG(orders) OVER (ORDER BY month), 1) AS pct_change\nFROM m\nORDER BY month;",
    ordered: true,
    explanation: "LAG/LEAD read neighbouring rows without a self join. Multiply by 100.0 (not 100) so Postgres does decimal division, not integer division.",
  },
  {
    kind: "sql", id: "login-streaks", title: "Longest login streak", level: "hard", stage: "windows", tags: ["gaps and islands"],
    prompt: "A streak is a run of logins on consecutive days: logins on 1, 2 and 3 March make a 3-day streak, and a missed day ends it. For each `user_id` in `logins`, return two columns: the `user_id` and the length in days of their longest streak (a lone day counts as 1). Any row order.",
    hint: "Gaps and islands: login_date minus ROW_NUMBER() (in days) is constant within a streak. Group by that.",
    solution: "WITH g AS (\n  SELECT user_id, login_date,\n         login_date - (ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY login_date))::int AS grp\n  FROM logins\n), streaks AS (\n  SELECT user_id, COUNT(*) AS len FROM g GROUP BY user_id, grp\n)\nSELECT user_id, MAX(len) AS longest_streak\nFROM streaks\nGROUP BY user_id;",
    ordered: false,
    explanation: "'Gaps and islands' is the classic hard SQL pattern: consecutive dates minus a consecutive counter give the same value. It also solves seat booking, uptime windows and sessionization.",
  },
  {
    kind: "sql", id: "retention", title: "Day-1 retention", level: "hard", stage: "windows", tags: ["retention", "self join"],
    prompt: "Look only at the users in `logins`. A user is **retained** if they logged in again on the very next day after their first login. Return one row with one column: the share of users who were retained, as a number from 0 to 1 rounded to 2 decimal places (0.50 means half of them).",
    hint: "Find each user's first login (MIN), then check whether first + 1 exists.",
    solution: "WITH firsts AS (\n  SELECT user_id, MIN(login_date) AS first_day FROM logins GROUP BY user_id\n)\nSELECT ROUND(AVG(CASE WHEN l.user_id IS NOT NULL THEN 1.0 ELSE 0 END), 2) AS day1_retention\nFROM firsts f\nLEFT JOIN logins l ON l.user_id = f.user_id AND l.login_date = f.first_day + 1;",
    ordered: false,
    explanation: "Product-analytics interviews love retention. AVG over a 1/0 flag is a neat way to compute a share.",
  },
  {
    kind: "sql", id: "org-chart", title: "Everyone under Vikram", level: "hard", stage: "subqueries", tags: ["recursive CTE", "hierarchy"],
    prompt: "Vikram Shah's `id` is 2. Find everyone who reports to him: directly (their `manager_id` is 2) or through others (their manager reports to him, and so on down). Return two columns: the person's `name` and their depth: 1 for a direct report, 2 for a direct report's report, and so on. Vikram himself is not included. Any row order.",
    hint: "WITH RECURSIVE: start from direct reports, then repeatedly join employees on manager_id.",
    solution: "WITH RECURSIVE tree AS (\n  SELECT id, name, 1 AS depth FROM employees WHERE manager_id = 2\n  UNION ALL\n  SELECT e.id, e.name, t.depth + 1\n  FROM employees e JOIN tree t ON e.manager_id = t.id\n)\nSELECT name, depth FROM tree;",
    ordered: false,
    explanation: "A recursive CTE has an anchor query and a recursive part joined with UNION ALL; Postgres repeats it until no new rows appear. It's breadth-first search written in SQL.",
    related: [{ app: "dsa-atlas", pattern: "Graphs" }, { app: "dsa-atlas", pattern: "Recursion" }],
  },
  {
    kind: "sql", id: "median-salary", title: "Median salary per department", level: "hard", stage: "aggregation", tags: ["percentile", "median"],
    prompt: "A median is the middle value once the salaries are sorted; when a department has an even number of people, it's the average of the two middle salaries. Return two columns: the `department_id` and its median salary, for each department that has employees. Leave out employees with no department. Any row order.",
    hint: "PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary).",
    solution: "SELECT department_id, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY salary) AS median_salary\nFROM employees\nWHERE department_id IS NOT NULL\nGROUP BY department_id;",
    ordered: false,
    explanation: "PERCENTILE_CONT interpolates between the two middle values; PERCENTILE_DISC picks an actual value. Without these, you'd rank rows and average the middle one or two.",
  },
  {
    kind: "sql", id: "bought-together", title: "Frequently bought together", level: "hard", stage: "joins", tags: ["self join", "pairs"],
    prompt: "Two products are bought together when both are in the same order. For every pair of products, count the orders that contain both. Write each pair once, smaller product id first. Return three columns: `product_a` (the smaller id), `product_b` (the larger id) and that number of orders. Keep only the top 3 pairs: most orders first; on a tie, the smaller `product_a` first, then the smaller `product_b`.",
    hint: "Self join order_items on the same order_id with a.product_id < b.product_id.",
    solution: "SELECT a.product_id AS product_a, b.product_id AS product_b, COUNT(*) AS together\nFROM order_items a\nJOIN order_items b ON a.order_id = b.order_id AND a.product_id < b.product_id\nGROUP BY 1, 2\nORDER BY together DESC, product_a, product_b\nLIMIT 3;",
    ordered: true,
    explanation: "The < condition both removes self-pairs and counts each pair once. This is the core of market-basket analysis.",
  },

  // ---------- CASE WHEN ----------
  {
    kind: "sql", id: "salary-bands", title: "Salary bands", level: "easy", stage: "basics", tags: ["CASE WHEN"],
    prompt: "Put every employee in a salary band: `high` when the salary is 150000 or more, `mid` when it's 100000 or more (but under 150000), and `low` otherwise. Return three columns: `name`, `salary` and the band. Any row order.",
    hint: "CASE WHEN … THEN … WHEN … THEN … ELSE … END. The first WHEN that is true wins, so check the biggest band first.",
    solution: "SELECT name, salary,\n       CASE WHEN salary >= 150000 THEN 'high'\n            WHEN salary >= 100000 THEN 'mid'\n            ELSE 'low'\n       END AS band\nFROM employees;",
    ordered: false,
    explanation: "CASE checks its WHENs from top to bottom and stops at the first true one. A salary of 160000 is also >= 100000, but it never gets that far. That's why the second WHEN doesn't need `AND salary < 150000`.",
  },
  {
    kind: "sql", id: "custom-category-order", title: "Products in shop order", level: "easy", stage: "basics", tags: ["CASE WHEN", "ORDER BY"],
    prompt: "The shop shows categories in its own order, not A to Z: Electronics first, then Books, then Grocery, then everything else. Inside each category, the cheapest product comes first. Return three columns: `name`, `category` and `price`, in that order.",
    hint: "You can ORDER BY a CASE expression: turn each category into a number (1, 2, 3, 4) and sort by that number, then by price.",
    solution: "SELECT name, category, price\nFROM products\nORDER BY CASE category\n           WHEN 'Electronics' THEN 1\n           WHEN 'Books' THEN 2\n           WHEN 'Grocery' THEN 3\n           ELSE 4\n         END,\n         price;",
    ordered: true,
    explanation: "ORDER BY accepts any expression, not just a column. Mapping values to numbers with CASE is the usual way to sort by a business order: priorities (urgent, high, low), statuses, or sizes (S, M, L, XL).",
  },
  {
    kind: "sql", id: "status-counts-per-city", title: "Delivered and cancelled orders per city", level: "medium", stage: "aggregation", tags: ["CASE WHEN", "conditional aggregation"],
    prompt: "For each customer city, count the orders that were delivered and the orders that were cancelled, side by side. Return three columns: `city`, the number of delivered orders and the number of cancelled orders. A city with no cancelled orders must show 0, not NULL. Any row order.",
    hint: "One GROUP BY city, with SUM(CASE WHEN status = '…' THEN 1 ELSE 0 END) for each count. Watch what SUM gives when every value is NULL.",
    solution: "SELECT c.city,\n       SUM(CASE WHEN o.status = 'delivered' THEN 1 ELSE 0 END) AS delivered,\n       SUM(CASE WHEN o.status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled\nFROM customers c\nJOIN orders o ON o.customer_id = c.id\nGROUP BY c.city;",
    ordered: false,
    explanation: "This is **conditional aggregation**: one pass over the rows, with a CASE inside each SUM deciding which rows count. Without `ELSE 0`, a city with no cancelled orders sums only NULLs, and SUM of only NULLs is NULL, not 0. `COUNT(CASE WHEN … THEN 1 END)` also works, because COUNT skips NULLs and gives 0. Postgres has a shorter form: `COUNT(*) FILTER (WHERE status = 'cancelled')`.",
  },
  {
    kind: "sql", id: "bonus-rules", title: "Bonus rules in the right order", level: "medium", stage: "basics", tags: ["CASE WHEN", "NULL"],
    prompt: "Work out each employee's bonus with these rules, checked in this order: (1) an employee with no department (`department_id` is NULL) gets 0; (2) anyone else earning 150000 or more gets 20% of their salary; (3) anyone else in Engineering (`department_id` = 1) gets 10%; (4) everyone else gets 5%. Return two columns: `name` and the bonus as a whole number. Any row order.",
    hint: "Put the WHENs in the same order as the rules. NULL needs IS NULL, not = NULL. Use salary * 20 / 100 to stay in whole numbers.",
    solution: "SELECT name,\n       CASE WHEN department_id IS NULL THEN 0\n            WHEN salary >= 150000 THEN salary * 20 / 100\n            WHEN department_id = 1 THEN salary * 10 / 100\n            ELSE salary * 5 / 100\n       END AS bonus\nFROM employees;",
    ordered: false,
    explanation: "The rules overlap: Asha Rao earns 250000 and is in Engineering, so rules 2 and 3 both fit her. The first true WHEN wins, so she gets 20% (50000), not 10%. Ananya Ghosh has no department: `department_id = 1` is UNKNOWN for her, not false, so without rule 1 she would fall through to the ELSE and get 5%. Writing `CASE department_id WHEN NULL THEN 0` doesn't work either, because that form compares with =, and = NULL is never true.",
  },
  {
    kind: "sql", id: "quarterly-pivot", title: "Revenue by category and quarter", level: "hard", stage: "aggregation", tags: ["CASE WHEN", "pivot"],
    prompt: "Make a table with one row per product category and one column per quarter of the year. Count only delivered orders; an order line's revenue is `quantity * unit_price` from `order_items`. A quarter is three months: January to March is quarter 1, and so on. Return five columns: `category`, then the revenue for quarters 1, 2, 3 and 4. Sort by category from A to Z.",
    hint: "Join order_items, orders and products. EXTRACT(QUARTER FROM order_date) gives 1 to 4. Then one SUM(CASE WHEN quarter = n THEN revenue ELSE 0 END) per column.",
    solution: "SELECT p.category,\n       SUM(CASE WHEN EXTRACT(QUARTER FROM o.order_date) = 1 THEN oi.quantity * oi.unit_price ELSE 0 END) AS q1,\n       SUM(CASE WHEN EXTRACT(QUARTER FROM o.order_date) = 2 THEN oi.quantity * oi.unit_price ELSE 0 END) AS q2,\n       SUM(CASE WHEN EXTRACT(QUARTER FROM o.order_date) = 3 THEN oi.quantity * oi.unit_price ELSE 0 END) AS q3,\n       SUM(CASE WHEN EXTRACT(QUARTER FROM o.order_date) = 4 THEN oi.quantity * oi.unit_price ELSE 0 END) AS q4\nFROM order_items oi\nJOIN orders o ON o.id = oi.order_id\nJOIN products p ON p.id = oi.product_id\nWHERE o.status = 'delivered'\nGROUP BY p.category\nORDER BY p.category;",
    ordered: true,
    explanation: "Turning rows into columns is called a **pivot**. Standard SQL has no PIVOT keyword (SQL Server and Oracle do), so the portable way is one SUM(CASE …) per column. The WHERE filter runs before grouping, so cancelled and pending orders never reach the sums. Interviewers ask this often, as \"monthly sales per product as columns\".",
  },

  // ---------- Theory ----------
  {
    kind: "theory", id: "acid", title: "What does ACID mean?", level: "easy", stage: "transactions", tags: ["ACID"],
    prompt: "Explain each letter of ACID with an example.",
    answer: "ACID is four promises a database makes about a **transaction** (a group of changes that belong together, such as moving money between two accounts).\n\n| Letter | Promise | Example: move 500 from account A to B |\n| --- | --- | --- |\n| **A**tomicity | All of the changes happen, or none do. | Never take 500 from A without adding it to B. If the server dies halfway, the half-done change is undone. |\n| **C**onsistency | Every rule in the schema still holds afterwards. | A `CHECK (balance >= 0)` stops A going below zero; the whole transaction fails instead. |\n| **I**solation | Transactions running at the same time don't see each other's half-done work (how strictly depends on the isolation level). | Someone reading A and B mid-transfer sees both before or both after, never 500 missing. |\n| **D**urability | Once `COMMIT` returns, the change survives a crash. | Postgres writes the change to its write-ahead log (WAL) on disk before saying \"committed\". |\n\n> 💡 In an interview, give the example, not just the words. Atomicity is about one transaction failing; isolation is about two transactions at the same time.\n\nThe full explanation, with examples you can run: [the lesson](/topics/transactions#acid).",
    related: [{ app: "structura", topic: "payment-idempotency" }],
  },
  {
    kind: "theory", id: "where-vs-having", title: "WHERE vs HAVING", level: "easy", stage: "aggregation", tags: ["HAVING"],
    prompt: "When do you use WHERE and when HAVING?",
    answer: "Both filter, but at different moments of the query.\n\n- **WHERE** runs before grouping. It sees single rows, so it can't use `COUNT`, `SUM` and the other aggregates.\n- **HAVING** runs after `GROUP BY`. It sees whole groups, so it can test `COUNT(*) >= 3`.\n\nThe order Postgres works in: `FROM` → `WHERE` → `GROUP BY` → `HAVING` → `SELECT` → `ORDER BY` → `LIMIT`.\n\n```sql\n-- Departments with 3+ people, not counting employees without a department\nSELECT department_id, COUNT(*) AS headcount\nFROM employees\nWHERE department_id IS NOT NULL   -- rows: before grouping\nGROUP BY department_id\nHAVING COUNT(*) >= 3;             -- groups: after grouping\n```\n\n> 💡 Put every filter you can in WHERE: fewer rows reach the grouping, so the query does less work.\n\nThe full explanation, with examples you can run: [the lesson](/topics/aggregation#where-vs-having).",
  },
  {
    kind: "theory", id: "join-types", title: "Types of joins", level: "easy", stage: "joins", tags: ["JOIN"],
    prompt: "Explain INNER, LEFT, RIGHT, FULL and CROSS joins.",
    answer: "A **join** puts rows from two tables side by side wherever a condition matches, usually a foreign key pointing at a primary key.\n\n```erd employees,departments\nTable departments {\n  id int [pk]\n  name text [not null]\n  location text [not null]\n}\n\nTable employees {\n  id int [pk]\n  name text [not null]\n  department_id int [ref: > departments.id, note: 'NULL for someone not yet placed']\n  manager_id int [ref: > employees.id]\n}\n```\n\nMany employees belong to one department (the crow's foot is the \"many\" side). Two rows make every join type different:\n\n- **Ananya Ghosh** has no department (`department_id` is NULL).\n- **Research** has no employees.\n\nTake three employees and three departments:\n\n| employees | department_id |   | departments | id |\n| --- | --- | --- | --- | --- |\n| Asha Rao | 1 |   | Engineering | 1 |\n| Arjun Menon | 2 |   | Sales | 2 |\n| Ananya Ghosh | NULL |   | Research | 6 |\n\n```sql\nSELECT e.name, d.name AS department\nFROM employees e\nLEFT JOIN departments d ON d.id = e.department_id;\n```\n\n| Join | Keeps | Result on the 3 + 3 rows | On the full shop data |\n| --- | --- | --- | --- |\n| `INNER JOIN` | only pairs that match | Asha–Engineering, Arjun–Sales | 20 rows: Ananya disappears |\n| `LEFT JOIN` | every left row; NULLs where nothing matches | the two pairs, plus Ananya–NULL | 21 rows |\n| `RIGHT JOIN` | every right row | the two pairs, plus NULL–Research | 21 rows |\n| `FULL JOIN` | unmatched rows from both sides | the two pairs, Ananya–NULL and NULL–Research | 22 rows |\n| `CROSS JOIN` | every combination, no condition | 3 × 3 = 9 rows | 21 × 6 = 126 rows |\n\nHow to say it in an interview:\n\n1. **Inner** is the default: \"show me things that have a match\".\n2. **Left** keeps everything from the main table: \"every employee, with their department if they have one\". Most reports are left joins.\n3. **Right** is a left join written the other way round; most people rewrite it as a left join.\n4. **Full** finds problems on both sides at once: employees without departments *and* departments without employees.\n5. **Cross** makes every combination: every size with every colour. On big tables it explodes (1,000 × 1,000 = 1,000,000 rows).\n\nTwo more you'll be asked about:\n\n- A **semi join** keeps left rows that have a match, without repeating them: `WHERE EXISTS (…)`.\n- An **anti join** keeps left rows that have no match: `WHERE NOT EXISTS (…)`, or `LEFT JOIN … WHERE d.id IS NULL`. \"Departments with no employees\" is an anti join.\n\n> ⚠️ A filter on the right table in `WHERE` (`WHERE d.location = 'Mumbai'`) turns a LEFT JOIN back into an inner one: the NULL rows fail the test. Put it in `ON` instead to keep them.\n\nSee the [Joins lesson](/topics/joins) for each one running on the shop data, with step-throughs.",
  },
  {
    kind: "theory", id: "index-how", title: "How does an index speed up a query?", level: "medium", stage: "indexing", tags: ["B-tree", "index"],
    prompt: "What is a B-tree index, and when does it not help?",
    answer: "An index is a separate, sorted structure that points at table rows, like the index at the back of a book.\n\n**How a B-tree lookup works.** A B-tree (balanced tree) keeps keys in sorted order in pages of about 8 KB. Each page holds hundreds of keys, so the tree is shallow: 3 or 4 levels cover millions of rows. To find `customer_id = 42`, Postgres reads the root page, one middle page and one leaf page (3 page reads), instead of scanning every page of the table.\n\n**It helps with:**\n\n- equality (`= 42`) and ranges (`BETWEEN`, `<`, `>`)\n- `ORDER BY` on the indexed column (the index is already sorted)\n- prefix searches: `LIKE 'abc%'`\n\n**It doesn't help when:**\n\n- the query reads a large part of the table: reading the table straight through is cheaper than jumping around\n- you wrap the column in a function: `WHERE lower(email) = …` (unless you index `lower(email)` itself)\n- the pattern starts with a wildcard: `LIKE '%abc'`\n- the column has very few distinct values (a status with 3 values)\n\n> ⚠️ Every index costs disk space and slows every INSERT, UPDATE and DELETE, because the index is updated too. Add the ones your queries need, not one per column.\n\nThe full explanation, with examples you can run: [the lesson](/topics/indexing#how-a-b-tree-index-works).",
    related: [{ app: "dsa-atlas", pattern: "Trees" }, { app: "dsa-atlas", pattern: "Binary Search" }],
  },
  {
    kind: "theory", id: "composite-index", title: "Column order in a composite index", level: "medium", stage: "indexing", tags: ["composite index"],
    prompt: "You have an index on (customer_id, order_date). Which queries can use it?",
    answer: "A **composite index** covers several columns, sorted by the first column, then by the second inside each first value: like a phone book sorted by surname, then first name.\n\nWith an index on `(customer_id, order_date)`:\n\n| Query | Uses the index? | Why |\n| --- | --- | --- |\n| `WHERE customer_id = 7` | Yes | The first column: like finding a surname |\n| `WHERE customer_id = 7 AND order_date > '2025-06-01'` | Yes, fully | One customer's orders sit together, sorted by date |\n| `WHERE customer_id = 7 ORDER BY order_date` | Yes, and no sort step | Already in date order inside customer 7 |\n| `WHERE order_date > '2025-06-01'` | Not efficiently | Dates are only sorted inside each customer: like finding everyone named \"Priya\" in a surname-sorted phone book |\n\nThis is the **leftmost-prefix rule**: an index helps a query that filters on its first column, or its first and second, and so on.\n\n- Put columns you test with `=` first, and range columns (`>`, `BETWEEN`) last.\n- If the index also holds every column the query reads, Postgres can answer from the index alone (an *index-only scan*). `INCLUDE (status)` adds a column to the index without sorting by it.\n\nThe full explanation, with examples you can run: [the lesson](/topics/indexing#composite-indexes-and-the-leftmost-prefix-rule).",
  },
  {
    kind: "theory", id: "isolation-levels", title: "Isolation levels and anomalies", level: "hard", stage: "transactions", tags: ["isolation", "MVCC"],
    prompt: "Name the isolation levels and the anomalies each one prevents.",
    answer: "The **isolation level** sets how much one transaction can see of others running at the same time. Stricter levels prevent more anomalies (wrong results caused by timing) but conflict more.\n\nThe anomalies:\n\n- **Dirty read**: you read a change another transaction hasn't committed yet (and may roll back).\n- **Non-repeatable read**: you read a row twice and get different values, because someone committed in between.\n- **Phantom**: you run the same `WHERE` twice and new rows appear.\n- **Write skew**: two transactions each check a rule, both pass, and together they break it (two doctors both go off call because each saw the other on call).\n\n| Level | Dirty read | Non-repeatable read | Phantom | Write skew |\n| --- | --- | --- | --- | --- |\n| Read Uncommitted | allowed by the SQL standard; Postgres runs it as Read Committed | possible | possible | possible |\n| Read Committed (Postgres default) | prevented | possible | possible | possible |\n| Repeatable Read | prevented | prevented | prevented in Postgres | possible |\n| Serializable | prevented | prevented | prevented | prevented |\n\nAt **Serializable**, Postgres lets transactions run and cancels one with a \"could not serialize\" error when they conflict, so your app must retry it.\n\n> 💡 The **lost update** (two people do `stock = stock - 1` from the same old value) is fixed at any level by updating in one statement, `UPDATE … SET stock = stock - 1`, or by locking the row first with `SELECT … FOR UPDATE`.\n\nThe full explanation, with examples you can run: [the lesson](/topics/transactions#isolation-levels-and-anomalies).",
    related: [{ app: "structura", topic: "locking" }],
  },
  {
    kind: "theory", id: "mvcc", title: "What is MVCC?", level: "hard", stage: "internals", tags: ["MVCC", "VACUUM"],
    prompt: "How do Postgres readers and writers avoid blocking each other?",
    answer: "**MVCC** (multi-version concurrency control) is how Postgres lets readers and writers work at the same time without waiting for each other.\n\n1. An `UPDATE` doesn't overwrite the row. It writes a **new version** of it and marks the old one as replaced.\n2. Each version records which transaction created it (`xmin`) and which one replaced or deleted it (`xmax`).\n3. Each query reads from a **snapshot**: the versions that were committed when it started. So a long report keeps seeing the same data while others write.\n\nWhat it costs:\n\n- Old versions (**dead tuples**) stay on disk until **VACUUM** removes them. Postgres runs autovacuum in the background.\n- A transaction left open for hours stops VACUUM removing anything newer than it, and tables grow (**bloat**).\n\n```sql\n-- Every row carries its version information\nSELECT xmin, xmax, id, name FROM products LIMIT 3;\n```\n\nThe full explanation, with examples you can run: [the lesson](/topics/internals#mvcc-vacuum-and-bloat).",
  },
  {
    kind: "theory", id: "normalization", title: "Normalization: 1NF to 3NF", level: "medium", stage: "modelling", tags: ["normalization"],
    prompt: "Explain 1NF, 2NF, 3NF and when you'd denormalize.",
    answer: "**Normalization** means storing each fact in one place, so an update can't leave two copies disagreeing.\n\n| Form | Rule | Breaks it | Fix |\n| --- | --- | --- | --- |\n| 1NF | One value per cell; no repeating groups | `phones = '98…, 99…'` in one column | A `phones` table, one row per number |\n| 2NF | With a composite key, every column depends on the whole key | `order_items(order_id, product_id, product_name)`: the name depends on the product only | Keep `product_name` in `products` |\n| 3NF | No column depends on another non-key column | `customers(city, city_state)`: the state depends on the city | A `cities` table; customers store `city_id` |\n\nAfter normalizing, each fact lives in one table:\n\n```erd customers,cities,phones\nTable cities {\n  id int [pk]\n  name text [not null]\n  state text [not null, note: '3NF: the state depends on the city, so it lives here']\n}\n\nTable customers {\n  id int [pk]\n  name text [not null]\n  city_id int [ref: > cities.id]\n}\n\nTable phones {\n  customer_id int [ref: > customers.id, note: '1NF: one number per row']\n  number text [not null]\n  indexes {\n    (customer_id, number) [pk]\n  }\n}\n\nTable products {\n  id int [pk]\n  name text [not null]\n  price numeric [not null]\n}\n\nTable order_items {\n  order_id int\n  product_id int [ref: > products.id]\n  quantity int [not null]\n  unit_price numeric [not null, note: 'the price at the time of the order: a different fact']\n  indexes {\n    (order_id, product_id) [pk]\n  }\n}\n```\n\n**When to denormalize** (keep a copy on purpose): when a read happens far more often than the data changes, and the join or calculation is too slow. For example, `orders.total` instead of summing lines on every page view. Then something must keep the copy right: the same transaction, a trigger, or a background job.\n\n> 💡 The shop's `order_items.unit_price` looks like a copy of `products.price`, but it isn't: it's the price *at the time of the order*. That's a different fact, so it belongs there.\n\nThe full explanation, with examples you can run: [the lesson](/topics/modelling#normalization-1nf-2nf-3nf).",
  },
  {
    kind: "theory", id: "sharding-vs-replication", title: "Replication vs sharding", level: "hard", stage: "scaling", tags: ["sharding", "replication"],
    prompt: "What's the difference, and how do you pick a shard key?",
    answer: "They solve different problems.\n\n| | Replication | Sharding |\n| --- | --- | --- |\n| What it does | Copies **all** the data to several servers | **Splits** the data across servers by a key |\n| Helps with | More reads; a standby if the main server dies | More writes and more data than one server holds |\n| Doesn't help with | Writes: every copy still applies every write | Queries that need data from several shards |\n| Catch | Copies can lag: you write, then read an old value from a replica | Joins and transactions across shards are slow and hard |\n\n**Choosing a shard key.** A good one:\n\n- has many distinct values (`user_id`, not `country`)\n- spreads load evenly, so no single shard is hot (not `created_date`, where every new write hits the newest shard)\n- keeps your most common queries on one shard (`tenant_id` in a business app: one customer's data stays together)\n\nConsistent hashing places keys on shards so that adding a shard moves only a small part of the data.\n\nThe full explanation, with examples you can run: [the lesson](/topics/scaling#sharding-and-choosing-a-shard-key).",
    related: [{ app: "structura", topic: "database-sharding" }, { app: "structura", topic: "consistent-hashing" }],
  },
  {
    kind: "theory", id: "cap", title: "CAP and PACELC", level: "hard", stage: "scaling", tags: ["CAP", "consistency"],
    prompt: "Explain the CAP theorem and why PACELC is more useful.",
    answer: "**CAP**: when the network splits a distributed database into parts that can't talk (a **partition**), each part must choose:\n\n- **Consistency**: refuse requests it can't answer with the latest data, or\n- **Availability**: answer anyway, possibly with old data.\n\nYou can't have both during a partition. With no partition, CAP says nothing, and that's most of the time.\n\n**PACELC** adds the normal case: if there's a **P**artition, choose **A** or **C**; **E**lse, choose **L**atency (answer fast from a nearby copy) or **C**onsistency (wait for the copies to agree).\n\n| Database | During a partition | Normally |\n| --- | --- | --- |\n| Google Spanner | Consistency | Consistency (waits) |\n| Cassandra, DynamoDB (default settings) | Availability | Latency |\n\nCassandra lets you choose per query with quorums: with N copies, reading R and writing W copies where R + W > N means every read overlaps the latest write. With N = 3, R = 2 and W = 2 gives 4 > 3.\n\nThe full explanation, with examples you can run: [the lesson](/topics/scaling#cap-and-pacelc).",
  },
  {
    kind: "theory", id: "sql-vs-nosql", title: "SQL or NoSQL?", level: "medium", stage: "nosql", tags: ["NoSQL", "trade-offs"],
    prompt: "How do you decide between a relational database and a NoSQL store?",
    answer: "Start with a relational database such as Postgres, and move a part of the data to something else when a specific need appears.\n\n**Postgres gives you:** joins, constraints that keep data correct, transactions, any query you think of later, and `JSONB` columns for the parts with no fixed shape.\n\n**Pick a NoSQL store for a specific access pattern:**\n\n| Need | Store | Why |\n| --- | --- | --- |\n| Look up items by key at huge scale, steady speed | DynamoDB | Partitions spread data automatically |\n| Very many writes of time-ordered data | Cassandra | Fast writes (LSM tree), scales by adding nodes |\n| Cache, counters, leaderboards | Redis | Data in memory, rich data structures |\n| Data that is mostly connections | Neo4j | Follows links without joins |\n| Full-text search | Elasticsearch | Inverted index: word → documents |\n| Analytics over billions of rows | ClickHouse | Stores columns, not rows |\n\n> 💡 With NoSQL you design tables around the queries you will run, not around the things in your domain. Changing your queries later can mean copying the data into a new shape.\n\nThe full explanation, with examples you can run: [the lesson](/topics/nosql#how-to-choose).",
    related: [{ app: "structura", topic: "key-value-store" }],
  },
  {
    kind: "theory", id: "lsm-vs-btree", title: "LSM tree vs B-tree storage", level: "hard", stage: "internals", tags: ["LSM", "B-tree", "storage engines"],
    prompt: "Why do Cassandra and RocksDB write faster than Postgres, and what do they pay for it?",
    answer: "They store data differently, so one is faster at writes and the other at reads.\n\n**B-tree (Postgres, MySQL):** keys live in sorted pages, updated in place. A write finds its page and changes it: a random write to disk. Reads are fast and predictable: walk 3 or 4 levels.\n\n**LSM tree (Cassandra, RocksDB):** short for log-structured merge tree.\n\n1. A write goes to a log on disk (for crash safety) and to a sorted table in memory (the **memtable**).\n2. When the memtable is full, it's written to disk as one sorted, never-changed file (an **SSTable**).\n3. In the background, **compaction** merges SSTables and drops old versions.\n\n| | B-tree | LSM tree |\n| --- | --- | --- |\n| Writes | Random disk writes | Sequential writes: much faster |\n| Reads | One place to look | May check several files (Bloom filters say which files to skip) |\n| Background work | VACUUM (in Postgres) | Compaction rewrites data many times (write amplification) |\n| Good for | Mixed reads and writes | Heavy writes: logs, events, time series |\n\nThe full explanation, with examples you can run: [the lesson](/topics/internals#b-trees-and-lsm-trees).",
    related: [{ app: "dsa-atlas", pattern: "Trees" }],
  },
  {
    kind: "theory", id: "procedure-vs-function", title: "Stored procedure vs function", level: "medium", stage: "views-functions", tags: ["procedure", "function"],
    prompt: "What's the difference between a stored procedure and a function?",
    answer: "Both are code saved in the database. They differ in how you run them and what they may do.\n\n| | Function | Procedure |\n| --- | --- | --- |\n| How you run it | inside a query: `SELECT order_total(5)`, `WHERE price_band(price) = 'mid'`, `FROM top_products(3)` | `CALL restock(4, 50)`, on its own |\n| Returns | a value, a row or a table | nothing, or values through `INOUT` arguments |\n| Can change data | yes, in Postgres (if `VOLATILE`) | yes |\n| `COMMIT` / `ROLLBACK` inside | never: it runs inside the caller's statement | yes, when called outside a transaction |\n| Typical use | calculations and lookups you use in queries | jobs with several steps; batches that commit as they go |\n\n```sql\nCREATE PROCEDURE restock(p_product int, p_qty int)\nLANGUAGE plpgsql\nAS $$\nBEGIN\n  UPDATE products SET stock = stock + p_qty WHERE id = p_product;\nEND;\n$$;\n\nCALL restock(4, 50);       -- works\n-- SELECT restock(4, 50);  -- error: restock(integer, integer) is a procedure\n```\n\n> 💡 Many interview answers come from SQL Server, where a function may not change data at all. In Postgres it can, so the real differences are how it's called and transaction control. Say which database you mean.\n\nThe full explanation, with examples you can run: [the lesson](/topics/views-functions#procedures-code-you-call).",
  },
  {
    kind: "theory", id: "view-vs-materialized-view", title: "View vs materialized view", level: "medium", stage: "views-functions", tags: ["view", "materialized view"],
    prompt: "What's the difference between a view and a materialized view, and how do you keep a materialized view fresh?",
    answer: "| | View | Materialized view |\n| --- | --- | --- |\n| Stores | the query | the query's **result**, on disk |\n| Up to date | always: it runs the query each time | as of the last `REFRESH` |\n| Reading it | as slow as the query | as fast as reading a table |\n| Indexes | uses the tables' indexes | can have its own |\n\nOn the shop data: a materialized view of revenue per category shows Furniture at 15,198,750. Cancel order 22 (₹101,995 of furniture) and it still shows 15,198,750, until `REFRESH MATERIALIZED VIEW category_revenue` brings it to 15,096,755.\n\nKeeping it fresh:\n\n- Refresh on a schedule (every hour, every night) and show \"as of\" next to the numbers.\n- `REFRESH MATERIALIZED VIEW CONCURRENTLY` lets readers keep reading the old rows during the refresh. It needs a unique index on the materialized view.\n- A refresh always re-runs the whole query. If that's too slow, keep a summary table up to date with triggers instead.\n\nThe full explanation, with examples you can run: [the lesson](/topics/views-functions#materialized-views-a-saved-result).",
  },
  {
    kind: "theory", id: "triggers-when", title: "When to use a trigger", level: "medium", stage: "views-functions", tags: ["trigger"],
    prompt: "When would you use a trigger, and what are the risks?",
    answer: "A **trigger** runs a function by itself when rows are inserted, updated or deleted. The function sees the row before the change (`OLD`) and after it (`NEW`).\n\nGood uses, for things that must happen on every change from every app:\n\n- an **audit log**: record every price change, whoever makes it;\n- **filling in a column**: a `BEFORE INSERT` trigger sets `unit_price` from the product when the app leaves it out;\n- **keeping another table in step**: an `AFTER INSERT` trigger on `order_items` reduces `products.stock`.\n\nThe risks:\n\n- **Hidden logic**: reading the app's `INSERT`, nobody sees that it also changes `products`.\n- **Speed**: a row trigger runs once per row, so a 1,000,000-row `UPDATE` calls it 1,000,000 times.\n- **Chains and loops**: a trigger that updates a table with its own triggers.\n\nA trigger runs inside the same transaction: if it fails, the change that fired it is undone too. Prefer a constraint (`CHECK`, `UNIQUE`, a foreign key) when one can express the rule.\n\nThe full explanation, with examples you can run: [the lesson](/topics/views-functions#triggers-run-code-when-rows-change).",
  },
  {
    kind: "theory", id: "index-skip-column", title: "An (a, b, c) index, queried on a and c", level: "medium", stage: "indexing", tags: ["composite index", "skip scan"],
    prompt: "You have an index on (a, b, c). Which of these use it: a = ?, a = ? AND c = ?, b = ? AND c = ?, c = ?",
    answer: "The index is sorted by `a`, then by `b` inside each `a`, then by `c` inside each `b`. It can jump straight to rows only from the left, with no gaps.\n\nOn 200,000 rows (`a` has 20 values, `b` and `c` 100 each), the whole table being 1,088 pages:\n\n| Query | How the index is used | Pages read |\n| --- | --- | --- |\n| `a = 7 AND b = 42 AND c = 3` | jumps straight to the row | 4 |\n| `a = 7 AND c = 3` | jumps to `a = 7`, then reads all its entries and checks `c` on each, inside the index | 56 |\n| `b = 42 AND c = 3` | Postgres 18 **skip scan**: one search for each value of `a` | 68 |\n| `c = 3` | not used: it reads the whole table | 1,088 |\n\n- The order of conditions in `WHERE` doesn't matter, only the column order in the index.\n- A range on a middle column (`b > 50`) works like a gap: `c` after it is only checked.\n- If `a` and `c` is a common query, an index on `(a, c, b)` reads 15 pages for it instead of 56.\n\nThe full explanation, with examples you can run: [the lesson](/topics/indexing#composite-indexes-and-the-leftmost-prefix-rule).",
  },
  {
    kind: "theory", id: "slower-after-index", title: "A query got slower after adding an index", level: "hard", stage: "indexing", tags: ["index", "EXPLAIN"],
    prompt: "You added an index and a query got slower. What could have happened?",
    answer: "The usual causes:\n\n1. **A worse plan for `ORDER BY … LIMIT`.** With an index on `created_at`, `WHERE kind = 'refund' ORDER BY created_at LIMIT 5` walks the index in date order, expecting refunds early. If all refunds are recent, it walks almost all of it: on 200,000 events, 1,805 pages instead of 1,280 for a plain scan and sort. An index on `(kind, created_at)` reads 4.\n2. **Slower writes.** Every insert, and most updates, must add an entry to every index: inserting 50,000 rows wrote about 5 MB of log with no index, and about 18 MB with three.\n3. **Lost HOT updates.** An index on a column you update often (`stock`, `updated_at`) makes every update write to every index.\n4. **Stale statistics.** After big data changes, the planner may use the index for a filter that now matches half the table. Run `ANALYZE`.\n\nTo find out, compare `EXPLAIN (ANALYZE, BUFFERS)` with and without the index, and look at estimated vs actual rows and pages read.\n\nThe full explanation, with examples you can run: [the lesson](/topics/indexing#when-an-index-makes-a-query-slower).",
  },
  {
    kind: "theory", id: "hot-updates", title: "HOT updates and fillfactor", level: "hard", stage: "internals", tags: ["MVCC", "HOT", "fillfactor"],
    prompt: "Why can a Postgres UPDATE of one column write to every index on the table, and how do you avoid it?",
    answer: "An `UPDATE` writes a new version of the row in a new place (MVCC), and every index points at the row's exact place. So, normally, every index gets a new entry, even indexes on columns that didn't change.\n\nA **HOT update** (heap-only tuple) skips the indexes when:\n\n1. no indexed column changes, and\n2. the new version fits on the same page as the old one.\n\nOn the shop data, `UPDATE products SET stock = stock + 1` is HOT for all 15 rows. Add an index on `stock` and the same update is HOT for none.\n\nHow to get more HOT updates:\n\n- Keep indexes off columns that change all the time.\n- Leave free space on pages with a lower **fillfactor**: 20,000 updates were HOT 9,000 times with `fillfactor = 70`, and never with the default 100.\n\n**MySQL's InnoDB** works the other way: it changes the row in place and copies the old version to an undo log, and its other indexes point to the primary key, so they don't change when the row does.\n\nThe full explanation, with examples you can run: [the lesson](/topics/internals#hot-updates-and-fillfactor).",
  },
  {
    kind: "theory", id: "query-stages", title: "How Postgres runs a query", level: "medium", stage: "internals", tags: ["planner", "EXPLAIN"],
    prompt: "What happens between sending a query and getting rows back? And what's the difference between EXPLAIN and EXPLAIN ANALYZE?",
    answer: "Five stages:\n\n| Stage | Does | Typical error |\n| --- | --- | --- |\n| Parser | checks grammar, builds a tree | *syntax error at or near \"FORM\"* |\n| Analyzer | looks up tables, columns, types | *column \"nme\" does not exist* |\n| Rewriter | replaces views with their queries; applies row-level security | |\n| Planner | estimates a cost for possible plans and picks the cheapest | |\n| Executor | runs the plan, pulling rows up through its nodes | *division by zero* |\n\n- `EXPLAIN` stops after the planner: it shows the chosen plan with **estimated** costs and rows. Nothing runs.\n- `EXPLAIN ANALYZE` also runs the executor: it adds **actual** rows, loops and time for each node. Add `BUFFERS` to see pages read. Careful: it really runs the query, so wrap an `UPDATE` or `DELETE` in a transaction and roll it back.\n\nA cost is worked out from settings: a sequential scan of `orders` costs 10 pages × 1 (`seq_page_cost`) + 1,500 rows × 0.01 (`cpu_tuple_cost`) = 25.00, exactly what `EXPLAIN` prints.\n\nThe full explanation, with examples you can run: [the lesson](/topics/internals#how-a-query-runs-parser-rewriter-planner-executor).",
  },
  {
    kind: "theory", id: "orm-mapper-validator", title: "ORM vs mapper vs validator", level: "easy", stage: "app-to-database", tags: ["ORM", "validation"],
    prompt: "What's the difference between an ORM, a mapper and a validator such as Zod? Where does each one go?",
    answer: "Each has one job, at a different place:\n\n| Tool | Job | Where | Example |\n| --- | --- | --- | --- |\n| **Validator** (Zod) | check untrusted input: shape, types, ranges | at the edge, when a request arrives | `quantity` must be a whole number from 1 to 10 |\n| **Mapper** | convert between shapes | at the API boundary | row `unit_price: \"18999.00\"` → DTO `unitPrice: 18999` |\n| **ORM** (Sequelize, Prisma) | write SQL, turn rows into objects, follow relations | between your code and the database | `OrderItem.create({…})` → `INSERT … VALUES ($1, $2, $3, $4)` |\n| **Constraints** | refuse bad rows, whoever sends them | in the database | foreign key: product 3 must exist |\n\nORMs also validate and map a little (Sequelize's `validate: { min: 1 }`, `field: \"order_id\"`), which is why they get mixed up. But the ORM's checks only run when that model is used. Keep the validator at the edge for good error messages, and constraints in the database for rules that must always hold: a validator can't know whether an email is already taken.\n\nThe full explanation, with examples you can run: [the lesson](/topics/app-to-database#one-request-from-the-browser-to-a-row).",
  },
  {
    kind: "theory", id: "sql-injection", title: "SQL injection and parameters", level: "medium", stage: "app-to-database", tags: ["security", "parameters"],
    prompt: "What is SQL injection, and how do parameters prevent it?",
    answer: "**SQL injection** is when input changes the query itself, because the app glued the input into the SQL text.\n\nSomeone types `x' OR '1'='1` into a name search. Glued in, the query becomes:\n\n```sql\nSELECT id, name FROM customers WHERE name = 'x' OR '1'='1'\n```\n\nThe input closed the quote and added a condition that's always true: all 203 customers come back.\n\nWith a **parameter**, the SQL and the value travel separately, so the input can only ever be a value:\n\n```sql\nPREPARE find_customer(text) AS SELECT id, name FROM customers WHERE name = $1;\nEXECUTE find_customer($$x' OR '1'='1$$);  -- 0 rows\n```\n\nIn code: `pool.query(\"… WHERE name = $1\", [name])`. ORMs use parameters for you; the risk is their raw-SQL escape hatches given a pasted-together string. Also give the app's database user only the rights it needs, so a mistake can't drop tables.\n\nThe full explanation, with examples you can run: [the lesson](/topics/app-to-database#parameters-never-string-building).",
  },
  {
    kind: "theory", id: "caching-patterns", title: "Caching a database", level: "medium", stage: "scaling", tags: ["Redis", "cache"],
    prompt: "Explain cache-aside, write-through and how to avoid stale data.",
    answer: "A cache (often Redis) keeps copies of hot data in memory so most reads don't reach the database.\n\n**Cache-aside** (the common one):\n\n1. Read: look in the cache. On a hit, done. On a miss, read the database, then store the value in the cache with a TTL (time to live: how long it may stay).\n2. Write: update the database, then **delete** the cache key. The next read fills it again.\n\nDelete rather than update the key: two writers updating the cache in the wrong order can leave an old value there.\n\n**Write-through:** every write goes to the cache and the database together, so the cache is always filled. Writes are slower.\n\n**Problems to name in an interview:**\n\n- **Stale data**: the cache holds an old value until it expires or is deleted. Short TTLs limit the damage.\n- **Thundering herd**: a hot key expires and thousands of requests hit the database at once. Let one request refill it (a lock), or refresh hot keys before they expire.\n- **Caching misses**: a missing item, asked for again and again, reaches the database every time. Cache \"not found\" for a short time too.\n\nThe full explanation, with examples you can run: [the lesson](/topics/scaling#caching).",
    related: [{ app: "structura", topic: "distributed-cache" }, { app: "structura", topic: "redis-basics" }],
  },
  // ---------- Schema design (DBML + diagram) ----------
  ...DESIGN_QUESTIONS,
];

export const questionById = (id: string) => QUESTIONS.find((q) => q.id === id);
