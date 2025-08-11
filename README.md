# y-indexeddb (UNOFFICIAL fork)

> IndexedDB database provider for Yjs. [Documentation](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb)

Note: This is an UNOFFICIAL fork of `yjs/y-indexeddb`. It includes a fix for unbounded growth of the `updates` store when reopening a document without changes (see issue #31) and additional tests. For the official package, see `https://github.com/yjs/y-indexeddb`.

Use the IndexedDB database adapter to store your shared data persistently in
the browser. The next time you join the session, your changes will still be
there.

- Minimizes the amount of data exchanged between server and client
- Makes offline editing possible

## Getting Started

If you just want to consume this fork in your projects without publishing, use a Git URL dependency:

```sh
npm i github:aag1024/y-indexeddb#master
```

Or pin to a commit:

```sh
npm i github:aag1024/y-indexeddb#<commit-sha>
```

You find the complete documentation published online: [API documentation](https://docs.yjs.dev/ecosystem/database-provider/y-indexeddb).

```sh
npm i --save @aag1024/y-indexeddb
```

```js
const provider = new IndexeddbPersistence(docName, ydoc);

provider.on("synced", () => {
  console.log("content from the database is loaded");
});
```

## Running tests

Tests run in the browser (IndexedDB is required). `npm test` only runs linting and type checks.

- Quick start (watch + open in browser):

  ```sh
  npm ci
  npm run debug
  ```

  This bundles the tests and starts a local server that opens `index.html`, which loads and runs the tests. Output appears on the page and in the browser console.

- One-off build + serve:

  ```sh
  npm ci
  npm run dist
  npx http-server -o .
  ```

- Lint/typecheck only:

  ```sh
  npm test
  ```

Requirements: Node >= 16 and npm >= 8.

## What’s different in this fork?

- Fix: prevent unbounded growth on reopen by only writing the initial snapshot when the `updates` store is empty.
- Tests: new cases to ensure no growth on reopen, persistence across sessions, and stability.

Upstream repository: `https://github.com/yjs/y-indexeddb`. If the fix lands upstream, prefer the official package.

## API

<dl>
  <b><code>provider = new IndexeddbPersistence(docName: string, ydoc: Y.Doc)</code></b>
  <dd>
Create a y-indexeddb persistence provider. Specify docName as a unique string
that identifies this document. In most cases, you want to use the same identifier
that is used as the room-name in the connection provider.
  </dd>
  <b><code>provider.on('synced', function(idbPersistence: IndexeddbPersistence))</code></b>
  <dd>
The "synced" event is fired when the connection to the database has been established
and all available content has been loaded. The event is also fired if no content
is found for the given doc name.
  </dd>
  <b><code>provider.set(key: any, value: any): Promise&lt;any&gt;</code></b>
  <dd>
Set a custom property on the provider instance. You can use this to store relevant
meta-information for the persisted document. However, the content will not be
synced with other peers.
  </dd>
  <b><code>provider.get(key: any): Promise&gt;any&lt;</code></b>
  <dd>
Retrieve a stored value.
  </dd>
  <b><code>provider.del(key: any): Promise&gt;undefined&lt;</code></b>
  <dd>
Delete a stored value.
  </dd>
  <b><code>provider.destroy(): Promise</code></b>
  <dd>
Close the connection to the database and stop syncing the document. This method is
automatically called when the Yjs document is destroyed (e.g. ydoc.destroy()).
  </dd>
  <b><code>provider.clearData(): Promise</code></b>
  <dd>
Destroy this database and remove the stored document and all related meta-information
from the database.
  </dd>
</dl>

## License

Yjs is licensed under the [MIT License](./LICENSE).

<kevin.jahns@protonmail.com>
