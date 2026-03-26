const A_WORDS = [
  "Absurd", "Accidental", "Aggressive", "Aimless", "Alarming", "Ambiguous",
  "Anarchic", "Anxious", "Apathetic", "Arbitrary", "Archaic", "Argumentative",
  "Arrogant", "Asinine", "Atrocious", "Audacious", "Automatic", "Awkward",
  "Abysmal", "Abstract", "Adversarial", "Agonizing", "Alienating", "Allegorical",
  "Amateur", "Amorphous", "Amusing", "Anomalous", "Antagonistic", "Anticlimactic",
  "Antiquated", "Appalling", "Approximate", "Artificial", "Assumptive", "Asymmetric",
  "Atonal", "Avoidable", "Accursed", "Acerbic", "Anachronistic", "Anonymous",
  "Antipathetic", "Abrupt", "Absurdist",
];

export function getRandomAWord(): string {
  return A_WORDS[Math.floor(Math.random() * A_WORDS.length)];
}

export function getQRAMOTitle(): string {
  return `QRAMO (Questionable Retroactive ${getRandomAWord()} Moral Offerings)`;
}
