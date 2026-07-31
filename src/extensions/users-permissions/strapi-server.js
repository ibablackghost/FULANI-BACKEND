module.exports = (plugin) => {
  const attrs = plugin.contentTypes?.user?.schema?.attributes;
  if (!attrs) return plugin;

  Object.assign(attrs, {
    firstName: { type: 'string' },
    lastName: { type: 'string' },
    phone: { type: 'string' },
  });

  return plugin;
};
