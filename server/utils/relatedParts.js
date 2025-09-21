// Simple rule-based related part suggestions.
// Keys can be part type keywords (lowercase) or specific part names.
module.exports = {
  'engine oil': ['oil filter', 'spark plug', 'air filter', 'cleaning kit'],
  'oil': ['oil filter', 'drain bolt washer'],
  'brake pad': ['brake fluid', 'disc cleaner'],
  'chain': ['chain lube', 'sprocket set'],
  'battery': ['battery terminals spray', 'wiring harness check'],
  'tyre': ['tube', 'wheel balancing weights'],
  'air filter': ['spark plug', 'throttle body cleaner'],
  'spark plug': ['air filter', 'engine oil'],
  // Fallback by category keywords
  '__category_engine': ['engine oil', 'oil filter', 'spark plug'],
  '__category_body': ['cleaning kit', 'polish'],
  '__category_electrical': ['battery terminals spray', 'wiring harness tape']
};