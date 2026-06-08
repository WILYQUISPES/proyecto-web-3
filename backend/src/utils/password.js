function checkStrength(pwd) {
  if (typeof pwd !== 'string') return { score: 0, level: 'debil' };
  let score = 0;
  if (pwd.length >= 8) score++;
  if (pwd.length >= 12) score++;
  if (/[a-z]/.test(pwd)) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  let level = 'debil';
  if (score >= 5) level = 'fuerte';
  else if (score >= 3) level = 'intermedio';

  return { score, level };
}

module.exports = { checkStrength };
