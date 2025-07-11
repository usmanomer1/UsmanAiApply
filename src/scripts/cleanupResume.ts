import { supabase } from '../lib/supabase';

export async function cleanupResumeData(userId: string) {
  console.log('Starting resume cleanup for user:', userId);
  
  try {
    // Step 1: Delete the file from storage (whether it's PNG or PDF)
    const filePath = `${userId}/resume.pdf`;
    console.log('Attempting to delete file:', filePath);
    
    const { error: deleteError } = await supabase.storage
      .from('resumes')
      .remove([filePath]);
    
    if (deleteError) {
      console.log('Storage deletion error (file may not exist):', deleteError);
    } else {
      console.log('File deleted from storage successfully');
    }
    
    // Step 2: Clear resume_url from ALL profile records for this user
    console.log('Clearing resume_url from all profile records...');
    
    const { data: updatedProfiles, error: updateError } = await supabase
      .from('profiles')
      .update({ resume_url: null })
      .eq('user_id', userId)
      .select();
    
    if (updateError) {
      console.error('Error updating profiles:', updateError);
      throw updateError;
    }
    
    console.log(`Updated ${updatedProfiles?.length || 0} profile records`);
    
    // Step 3: Delete duplicate profile records, keeping only the most recent
    console.log('Cleaning up duplicate profiles...');
    
    const { data: allProfiles, error: fetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    
    if (fetchError) {
      console.error('Error fetching profiles:', fetchError);
      throw fetchError;
    }
    
    if (allProfiles && allProfiles.length > 1) {
      // Keep the first (most recent) profile
      const profilesToDelete = allProfiles.slice(1).map(p => p.id);
      
      const { error: deleteProfilesError } = await supabase
        .from('profiles')
        .delete()
        .in('id', profilesToDelete);
      
      if (deleteProfilesError) {
        console.error('Error deleting duplicate profiles:', deleteProfilesError);
      } else {
        console.log(`Deleted ${profilesToDelete.length} duplicate profiles`);
      }
    }
    
    console.log('Resume cleanup completed successfully!');
    return { success: true, message: 'Resume data cleaned up successfully' };
    
  } catch (error) {
    console.error('Cleanup failed:', error);
    return { success: false, error };
  }
}

// Function to be called from the UI
export async function runCleanup() {
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    console.error('No user logged in');
    return { success: false, error: 'No user logged in' };
  }
  
  return cleanupResumeData(user.id);
}