import { supabaseAdmin } from './src/lib/supabase/server';

async function checkDB() {
    const { data: kbs, error: kbError } = await supabaseAdmin
        .from('knowledge_bases')
        .select('id, name, embedding_provider, embedding_model, embedding_dimensions');

    if (kbError) {
        console.error('Error fetching KBs:', kbError);
        return;
    }

    console.log('Knowledge Bases:', JSON.stringify(kbs, null, 2));

    for (const kb of kbs) {
        const { count, error: countError } = await supabaseAdmin
            .from('documents')
            .select('*', { count: 'exact', head: true })
            .eq('knowledge_base_id', kb.id);

        console.log(`KB "${kb.name}" (${kb.id}) has ${count} documents`);

        const { data: docs } = await supabaseAdmin
            .from('documents')
            .select('id')
            .eq('knowledge_base_id', kb.id);

        if (docs && docs.length > 0) {
            const { count: chunkCount } = await supabaseAdmin
                .from('document_chunks')
                .select('*', { count: 'exact', head: true })
                .in('document_id', docs.map(d => d.id));

            console.log(`KB "${kb.name}" total chunks: ${chunkCount}`);
        }
    }
}

checkDB();
