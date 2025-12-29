import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date (without time)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];

    // Find all active rivalries that have expired (end_date < today)
    const { data: expiredRivalries, error: fetchError } = await supabase
      .from("habit_rivalries")
      .select("*")
      .eq("status", "active")
      .lt("end_date", todayStr);

    if (fetchError) {
      console.error("Error fetching expired rivalries:", fetchError);
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!expiredRivalries || expiredRivalries.length === 0) {
      return new Response(
        JSON.stringify({ message: "No expired rivalries to process", processed: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${expiredRivalries.length} expired rivalries to complete`);

    const results = [];

    for (const rivalry of expiredRivalries) {
      // Get completion counts for this rivalry
      const { data: completions } = await supabase
        .from("habit_completions")
        .select(`
          client_id,
          client_habit_id,
          completed_date,
          client_habits!inner(rivalry_id)
        `)
        .gte("completed_date", rivalry.start_date)
        .lte("completed_date", rivalry.end_date);

      // Filter to this rivalry
      interface CompletionWithHabit {
        client_id: string;
        client_habit_id: string;
        completed_date: string;
        client_habits: { rivalry_id: string | null } | null;
      }
      const rivalryCompletions = (completions || []).filter((c: CompletionWithHabit) => {
        const ch = c.client_habits;
        return ch?.rivalry_id === rivalry.id;
      });

      const challengerCount = rivalryCompletions.filter(
        (c: CompletionWithHabit) => c.client_id === rivalry.challenger_id
      ).length;
      const opponentCount = rivalryCompletions.filter(
        (c: CompletionWithHabit) => c.client_id === rivalry.opponent_id
      ).length;

      // Determine winner
      let winnerId: string | null = null;
      if (challengerCount > opponentCount) {
        winnerId = rivalry.challenger_id;
      } else if (opponentCount > challengerCount) {
        winnerId = rivalry.opponent_id;
      }
      // If tied, winner_id stays null

      // Update the rivalry
      const { error: updateError } = await supabase
        .from("habit_rivalries")
        .update({
          status: "completed",
          winner_id: winnerId,
        })
        .eq("id", rivalry.id);

      if (updateError) {
        console.error(`Error updating rivalry ${rivalry.id}:`, updateError);
        results.push({
          id: rivalry.id,
          name: rivalry.name,
          success: false,
          error: updateError.message,
        });
      } else {
        console.log(`Completed rivalry: ${rivalry.name} (${rivalry.id})`);
        console.log(`  Challenger: ${challengerCount}, Opponent: ${opponentCount}`);
        console.log(`  Winner: ${winnerId || "TIE"}`);
        results.push({
          id: rivalry.id,
          name: rivalry.name,
          success: true,
          scores: { challenger: challengerCount, opponent: opponentCount },
          winner_id: winnerId,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} expired rivalries`,
        processed: results.length,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Unexpected error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
