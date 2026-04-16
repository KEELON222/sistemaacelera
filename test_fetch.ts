import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function testFetch() {
    console.log("Fetching boards...");
    const { data, error } = await supabase.from('boards').select('*');
    if (error) {
        console.error("Error fetching boards:", error);
    } else {
        console.log("Boards:", data);
    }
}

testFetch();
