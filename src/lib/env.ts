function required(name: string, value: string | undefined) {
  if (!value) throw new Error(`Variável de ambiente ausente: ${name}. Veja .env.example.`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseKey() {
    return required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
  },
  get supabaseSecretKey() {
    return process.env.SUPABASE_SECRET_KEY;
  },
};
