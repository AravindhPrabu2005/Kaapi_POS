function columnBuilder(name) {
  const col = {
    name,
    primaryKey: () => col,
    defaultRandom: () => col,
    notNull: () => col,
    default: () => col,
    defaultNow: () => col,
    references: () => col,
    unique: () => col,
  };
  return col;
}

function pgTable(tableName, columns) {
  const table = {
    tableName,
  };
  for (const [key, value] of Object.entries(columns)) {
    table[key] = value;
  }
  return table;
}

module.exports = {
  pgTable,
  uuid: (name) => columnBuilder(name),
  text: (name) => columnBuilder(name),
  varchar: (name) => columnBuilder(name),
  timestamp: (name) => columnBuilder(name),
  boolean: (name) => columnBuilder(name),
  integer: (name) => columnBuilder(name),
  decimal: (name) => columnBuilder(name),
  uniqueIndex: () => ({}),
  primaryKey: () => ({}),
};
