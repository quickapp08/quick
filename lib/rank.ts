export function getRank(points: number) {
  if (points >= 1000) return "Godlike";
  if (points >= 500) return "Flash";
  if (points >= 200) return "No Joke";
  if (points >= 100) return "Speedy";
  if (points >= 50) return "Turtle";
  if (points >= 10) return "Snail";
  return "Rookie";
}
