/**
 * Schema-design problems: write DBML, see it as a diagram, and check it.
 * The checks are in erd/checks.ts; `npm test` makes sure each model answer passes
 * all of them and each starter doesn't.
 */
import { check, type DesignCheck } from "../erd/checks";
import type { EcoRef } from "../ecosystem";

export interface DesignQuestion {
  kind: "design";
  id: string;
  title: string;
  level: "easy" | "medium" | "hard";
  stage: string;
  tags: string[];
  related?: EcoRef[];
  prompt: string;
  requirements: string[];
  /** DBML the editor starts with. */
  starter: string;
  checks: DesignCheck[];
  /** A model answer, in DBML. */
  solution: string;
  explanation: string;
}

const LINES = ["order_items", "order_lines", "order_products", "line_items"];
const LOANS = ["loans", "borrowings", "checkouts"];
const COPIES = ["copies", "book_copies", "items"];
const MEMBERS = ["members", "patrons", "users", "borrowers"];
const SHOWS = ["shows", "showings", "screenings", "showtimes"];

export const DESIGN_QUESTIONS: DesignQuestion[] = [
  {
    kind: "design",
    id: "design-blog-tags",
    title: "Design: blog posts with tags",
    level: "easy",
    stage: "modelling",
    tags: ["many-to-many", "junction table"],
    prompt: "Design the tables for a blog. Authors write posts; a post can have many tags and a tag is used on many posts.",
    requirements: ["Users who write posts", "Posts, each written by one user", "Tags, shared between posts", "A post can't get the same tag twice"],
    starter: "// Write DBML: tables, columns and refs. The diagram updates as you type.\nTable users {\n  id int [pk]\n  name varchar [not null]\n}\n",
    checks: [
      check.table(["posts", "articles"], "There is a posts table"),
      check.table(["tags"], "There is a tags table"),
      check.ref(["posts", "articles"], ["users", "authors"], "Each post points at its author"),
      check.manyToMany(["posts", "articles"], ["tags"], "Posts and tags are many-to-many through a junction table, unique per pair"),
      check.everyTableHasPk(),
    ],
    solution: `Table users {
  id int [pk]
  name varchar [not null]
  email varchar [not null, unique]
}

Table posts {
  id int [pk]
  author_id int [not null, ref: > users.id]
  title varchar [not null]
  body text
  published_at timestamptz
}

Table tags {
  id int [pk]
  name varchar [not null, unique]
}

Table post_tags {
  post_id int [ref: > posts.id]
  tag_id int [ref: > tags.id]

  indexes {
    (post_id, tag_id) [pk]
  }
}
`,
    explanation:
      "One-to-many (a user writes many posts) is a foreign key on the many side: posts.author_id. Many-to-many (posts ↔ tags) can't be a column on either table, so it gets its own junction table, post_tags. Its composite primary key (post_id, tag_id) stops the same tag being added to a post twice, and is also the index for \"tags of this post\".",
  },
  {
    kind: "design",
    id: "design-order-history",
    title: "Design: orders that keep their prices",
    level: "medium",
    stage: "modelling",
    tags: ["order lines", "snapshots"],
    prompt:
      "Design an online shop's orders. Customers place orders with several products in different quantities. Product prices change over time, but an old order must still show what the customer actually paid.",
    requirements: [
      "Customers and products",
      "Orders, each placed by one customer",
      "Each order has several products, each with a quantity",
      "The price paid is kept on the order, not looked up from today's product price",
    ],
    starter: "Table customers {\n  id int [pk]\n  name varchar\n}\n\nTable products {\n  id int [pk]\n  name varchar\n  price numeric(10,2)\n}\n",
    checks: [
      check.table(["orders"], "There is an orders table"),
      check.ref(["orders"], ["customers"], "Each order points at its customer"),
      check.manyToMany(["orders"], ["products"], "Order lines link orders to products, one line per product"),
      check.column(LINES, /price|amount|cost/, "Each order line keeps the price paid", "Copy the price onto the order line (e.g. unit_price) when the order is placed."),
      check.column(LINES, /qty|quantity/, "Each order line has a quantity", "Add a quantity column to the order line."),
      check.everyTableHasPk(),
    ],
    solution: `Table customers {
  id int [pk]
  name varchar [not null]
  email varchar [not null, unique]
}

Table products {
  id int [pk]
  name varchar [not null]
  price numeric(10,2) [not null, note: 'Today\\'s price']
}

Table orders {
  id int [pk]
  customer_id int [not null, ref: > customers.id]
  placed_at timestamptz [not null]
  status varchar [not null]
}

Table order_items {
  order_id int [ref: > orders.id]
  product_id int [ref: > products.id]
  quantity int [not null]
  unit_price numeric(10,2) [not null, note: 'Price when ordered']

  indexes {
    (order_id, product_id) [pk]
  }
}
`,
    explanation:
      "order_items is the junction between orders and products, and it carries data about the pair: quantity and unit_price. Copying the price is deliberate denormalization: products.price is today's price, while order_items.unit_price is a historical fact that must not change when the product does. The shop dataset in the SQL editor is built this way.",
  },
  {
    kind: "design",
    id: "design-library",
    title: "Design: library loans",
    level: "medium",
    stage: "modelling",
    tags: ["entities", "history"],
    prompt:
      "A library has many copies of each book. Members borrow copies and return them later. Design the tables so you can answer: which copies are out right now, and what has a member borrowed before?",
    requirements: ["Books and their physical copies", "Members", "Loans: which member borrowed which copy, when, and when it came back", "Past loans are kept, not overwritten"],
    starter: "Table books {\n  id int [pk]\n  title varchar\n}\n",
    checks: [
      check.table(COPIES, "Copies are separate from books"),
      check.ref(COPIES, ["books"], "Each copy points at its book"),
      check.table(MEMBERS, "There is a members table"),
      check.ref(LOANS, COPIES, "A loan points at the copy borrowed"),
      check.ref(LOANS, MEMBERS, "A loan points at the member"),
      check.column(LOANS, /return/, "A loan records when the copy came back", "Add a nullable returned_at: NULL means the copy is still out."),
      check.everyTableHasPk(),
    ],
    solution: `Table authors {
  id int [pk]
  name varchar [not null]
}

Table books {
  id int [pk]
  title varchar [not null]
  author_id int [ref: > authors.id]
  isbn varchar [unique]
}

Table copies {
  id int [pk]
  book_id int [not null, ref: > books.id]
  shelf varchar
}

Table members {
  id int [pk]
  name varchar [not null]
  joined_on date [not null]
}

Table loans {
  id int [pk]
  copy_id int [not null, ref: > copies.id]
  member_id int [not null, ref: > members.id]
  borrowed_at timestamptz [not null]
  due_on date [not null]
  returned_at timestamptz [note: 'NULL while the copy is out']
}
`,
    explanation:
      "A book (the title) and a copy (the thing on the shelf) are different entities: one book, many copies. A loan is an event, so it gets a new row each time, which keeps the history. \"What's out now\" is WHERE returned_at IS NULL. A partial unique index on loans (copy_id) WHERE returned_at IS NULL would stop one copy being lent twice at once.",
  },
  {
    kind: "design",
    id: "design-follows",
    title: "Design: followers, like Twitter",
    level: "medium",
    stage: "modelling",
    tags: ["self-referencing", "many-to-many"],
    prompt: "Users post short messages and follow other users. Following isn't mutual: I can follow you without you following me. Design the tables.",
    requirements: ["Users", "Posts, each by one user", "Who follows whom, in one direction", "You can't follow the same person twice"],
    starter: "Table users {\n  id int [pk]\n  handle varchar [unique]\n}\n",
    checks: [
      check.ref(["posts", "tweets", "messages"], ["users"], "Each post points at its user"),
      check.manyToMany(["users"], ["users"], "A follows table links users to users, unique per pair"),
      check.everyTableHasPk(),
    ],
    solution: `Table users {
  id int [pk]
  handle varchar [not null, unique]
  created_at timestamptz [not null]
}

Table posts {
  id bigint [pk]
  user_id int [not null, ref: > users.id]
  body varchar(280) [not null]
  created_at timestamptz [not null]
}

Table follows {
  follower_id int [ref: > users.id]
  followee_id int [ref: > users.id]
  created_at timestamptz [not null]

  indexes {
    (follower_id, followee_id) [pk]
  }
}
`,
    explanation:
      "Following is a many-to-many from users to users, so the junction table has two foreign keys to the same table, named by role (follower_id, followee_id). The composite primary key prevents duplicates and answers \"who do I follow\". \"Who follows me\" needs a second index on (followee_id, follower_id). A CHECK (follower_id <> followee_id) stops people following themselves. Walking this graph is a recursive CTE.",
    related: [{ app: "dsa-atlas", pattern: "Graphs" }],
  },
  {
    kind: "design",
    id: "design-cinema",
    title: "Design: cinema seat booking",
    level: "hard",
    stage: "modelling",
    tags: ["constraints", "concurrency"],
    prompt:
      "Design a cinema's booking system. A cinema has screens; each screen has fixed seats. A movie is shown many times (a show). Customers book one or more seats for a show. Two customers must never get the same seat for the same show.",
    requirements: ["Movies, screens and their seats", "Shows: a movie on a screen at a time", "Bookings by customers, with one or more seats", "The database itself prevents double-booking a seat for a show"],
    starter: "Table movies {\n  id int [pk]\n  title varchar\n}\n\nTable screens {\n  id int [pk]\n  name varchar\n}\n",
    checks: [
      check.ref(["seats"], ["screens"], "Seats belong to a screen"),
      check.ref(SHOWS, ["movies"], "A show points at its movie"),
      check.ref(SHOWS, ["screens"], "A show points at its screen"),
      check.uniqueAcross(
        [SHOWS, ["seats"]],
        "A seat can be booked only once per show (unique show + seat)",
        "Keep booked seats in a table with show_id and seat_id, and make (show_id, seat_id) its primary key or unique.",
      ),
      check.everyTableHasPk(),
    ],
    solution: `Table movies {
  id int [pk]
  title varchar [not null]
  minutes int [not null]
}

Table screens {
  id int [pk]
  name varchar [not null]
}

Table seats {
  id int [pk]
  screen_id int [not null, ref: > screens.id]
  row_label varchar(2) [not null]
  number int [not null]

  indexes {
    (screen_id, row_label, number) [unique]
  }
}

Table shows {
  id int [pk]
  movie_id int [not null, ref: > movies.id]
  screen_id int [not null, ref: > screens.id]
  starts_at timestamptz [not null]
}

Table customers {
  id int [pk]
  email varchar [not null, unique]
}

Table bookings {
  id int [pk]
  customer_id int [not null, ref: > customers.id]
  show_id int [not null, ref: > shows.id]
  created_at timestamptz [not null]
}

Table booked_seats {
  show_id int [ref: > shows.id]
  seat_id int [ref: > seats.id]
  booking_id int [not null, ref: > bookings.id]

  indexes {
    (show_id, seat_id) [pk]
  }
}
`,
    explanation:
      "Double-booking is prevented by a constraint, not by application code. booked_seats has a primary key on (show_id, seat_id), so when two people race for the same seat the second INSERT fails with a unique violation, even under concurrency. show_id is copied onto booked_seats (it's also on bookings) precisely so the constraint can include it. A trigger or composite foreign key should also make sure the seat is on the show's screen.",
    related: [{ app: "structura", topic: "locking" }],
  },
];
