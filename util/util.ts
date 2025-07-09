export function save_accesing_env_field(field: string) {
  if (process.env[field]) return process.env[field]!;

  throw Error(`could not found ${field} in .env file!`);
}
