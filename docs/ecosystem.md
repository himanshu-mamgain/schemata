# App ecosystem

Schemata, [DSA Atlas](https://github.com/himanshu-mamgain/dsa-atlas) and [Structura](https://github.com/himanshu-mamgain/structura) are linked apps. Each keeps its own data on the device; they connect through links, a shared app list and, optionally, one Studia account (GitHub sign-in through Supabase) that syncs each app's progress across devices. See the README, "Studia account".

## Apps

| id | Name | URL | Accent |
| --- | --- | --- | --- |
| `dsa-atlas` | DSA Atlas | https://dsa-atz.netlify.app | `#34d399` |
| `structura` | Structura | https://structura-web.netlify.app | `#a78bfa` |
| `schemata` | Schemata | https://schemata-web.netlify.app | `#38bdf8` |

Source of truth here: [`src/ecosystem.ts`](../src/ecosystem.ts). DSA Atlas (`packages/shared/src/ecosystem.ts`) and Structura keep the same list. When an app is added, update all three.

## Links into Schemata (keep stable)

| Link | URL |
| --- | --- |
| Roadmap stage or database guide | `https://schemata-web.netlify.app/topics/<topicId>` |
| Interview question | `https://schemata-web.netlify.app/questions/<questionId>` |
| SQL editor on a dataset | `https://schemata-web.netlify.app/playground?dataset=<shop\|chinook\|northwind>` |
| Schema diagram editor | `https://schemata-web.netlify.app/erd` |

The older query forms still work and redirect to these (`netlify.toml`): `/?topic=<topicId>`, `/?q=<questionId>`, `/?page=playground&dataset=<id>`. DSA Atlas builds `/?topic=…` links today; either form is fine.

Topic ids are listed at `https://schemata-web.netlify.app/topics.json` (`[{ id, title, blurb }]`, served with `Access-Control-Allow-Origin: *`). Examples: `indexing`, `transactions`, `scaling`, `postgresql`, `redis`, `cassandra`.

## Links out of Schemata

- Structura topic: `https://structura-web.netlify.app/?topic=<topicId>`. Topic titles come from Structura's `topics.json`, copied at build time into `src/data/structura-topics.json`.
- DSA Atlas checklist pattern: `https://dsa-atz.netlify.app/?page=checklist&pattern=<pattern>` (e.g. `Trees` for B-trees, `Graphs` for recursive CTEs).

## To do in the other repos

- **DSA Atlas** and **Structura**: add Schemata to their app switchers (the entry in the table above).
- **Structura**: on database topics (`database-sharding`, `redis-basics`, `locking`, `vector-database`…), link to the matching Schemata topic.
