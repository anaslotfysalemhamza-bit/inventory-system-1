// ============================================================
// 🖼️ Load User Avatar - تحميل صورة المستخدم
// ============================================================

(function() {
    'use strict';
    
    const API_URL = window.API_URL || 'http://localhost:5000/api';
    const BACKEND_URL = window.BACKEND_URL || 'http://localhost:5000';
    
    // ============================================================
    // Load Current User Avatar
    // ============================================================
    async function loadUserAvatar() {
        try {
            const currentUser = JSON.parse(localStorage.getItem('currentUser') || '{}');
            
            if (!currentUser.id) {
                console.warn('⚠️ No user logged in');
                return;
            }
            
            // Try to get avatar from API first
            try {
                const response = await fetch(`${API_URL}/user-avatar/${currentUser.id}`);
                
                if (response.ok) {
                    const data = await response.json();
                    
                    if (data.success && data.data && data.data.profilePicture) {
                        updateAvatarDisplay(data.data.profilePicture, data.data.name);
                        return;
                    }
                }
            } catch (apiError) {
                console.warn('⚠️ API fetch failed, trying localStorage:', apiError.message);
            }
            
            // Fallback to localStorage
            const profilePicture = localStorage.getItem(`profilePicture_${currentUser.id}`);
            
            if (profilePicture) {
                updateAvatarDisplay(profilePicture, currentUser.name);
            } else {
                updateAvatarDisplay(null, currentUser.name);
            }
            
        } catch (error) {
            console.error('❌ Error loading user avatar:', error);
        }
    }
    
    // ============================================================
    // Update Avatar Display
    // ============================================================
    function updateAvatarDisplay(profilePicture, userName) {
        const avatarElements = document.querySelectorAll('.user-avatar, .profile-picture, [data-user-avatar]');
        
        avatarElements.forEach(element => {
            if (profilePicture) {
                // Check if it's a full URL or just a filename
                let imageUrl = profilePicture;
                
                if (!profilePicture.startsWith('http') && !profilePicture.startsWith('data:')) {
                    imageUrl = `${BACKEND_URL}/uploads/${profilePicture}`;
                }
                
                element.style.backgroundImage = `url('${imageUrl}')`;
                element.style.backgroundSize = 'cover';
                element.style.backgroundPosition = 'center';
                
                // If it's an img tag
                if (element.tagName === 'IMG') {
                    element.src = imageUrl;
                }
            } else {
                // Show default avatar (first letter of name)
                const initial = userName ? userName.charAt(0).toUpperCase() : '?';
                element.textContent = initial;
                element.style.backgroundImage = 'none';
            }
        });
        
        // Update username displays
        const usernameElements = document.querySelectorAll('.user-name, [data-user-name]');
        usernameElements.forEach(element => {
            if (userName) {
                element.textContent = userName;
            }
        });
        
        console.log('✅ User avatar loaded successfully');
    }
    
    // ============================================================
    // Initialize on page load
    // ============================================================
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadUserAvatar);
    } else {
        loadUserAvatar();
    }
    
    // Export for manual refresh
    window.loadUserAvatar = loadUserAvatar;
    
})();
