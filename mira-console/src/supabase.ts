import { createClient } from "@supabase/supabase-js";

// Create a single supabase client for interacting with your database
export const supabase = createClient(
  "https://atmocsvasyapsvwsustd.supabase.co",
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0bW9jc3Zhc3lhcHN2d3N1c3RkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzM0MDU3MzksImV4cCI6MjA0ODk4MTczOX0.El1ea2CUZLlvp1EY9iNbx0RGvIX7YARMVUKem7_aC4E"
);
