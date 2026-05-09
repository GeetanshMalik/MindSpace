// ============================================
// MINDSPACE WEBSITE - JAVASCRIPT
// ============================================

// Wait for DOM to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    
    // ============================================
    // PAGE LOADER
    // ============================================
    const pageLoader = document.querySelector('.page-loader');
    
    window.addEventListener('load', function() {
        setTimeout(() => {
            pageLoader.classList.add('hidden');
        }, 1000);
    });
    
    // ============================================
    // WELCOME MODAL
    // ============================================
    const welcomeModal = document.getElementById('welcomeModal');
    const modalClose = document.getElementById('modalClose');
    const modalContinue = document.getElementById('modalContinue');
    
    // Check if modal has been closed before
    const modalClosed = localStorage.getItem('mindspace_modal_closed');
    
    if (!modalClosed) {
        setTimeout(() => {
            welcomeModal.classList.add('active');
        }, 1500);
    }
    
    // Close modal function
    function closeModal() {
        welcomeModal.classList.remove('active');
        localStorage.setItem('mindspace_modal_closed', 'true');
    }
    
    modalClose.addEventListener('click', closeModal);
    modalContinue.addEventListener('click', closeModal);
    
    // Close on backdrop click
    welcomeModal.querySelector('.modal-backdrop').addEventListener('click', closeModal);
    
    // ============================================
    // NAVIGATION
    // ============================================
    const navbar = document.getElementById('navbar');
    const navToggle = document.getElementById('navToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    
    // Navbar scroll effect
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });
    
    // Mobile menu toggle
    navToggle.addEventListener('click', function() {
        mobileMenu.classList.toggle('active');
        
        // Animate hamburger
        const spans = navToggle.querySelectorAll('span');
        if (mobileMenu.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translateY(8px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translateY(-8px)';
        } else {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    });
    
    // Close mobile menu on link click
    const mobileLinks = document.querySelectorAll('.mobile-link, .mobile-link-btn');
    mobileLinks.forEach(link => {
        link.addEventListener('click', function() {
            mobileMenu.classList.remove('active');
            const spans = navToggle.querySelectorAll('span');
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        });
    });
    
    // ============================================
    // SMOOTH SCROLL
    // ============================================
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
    
    // ============================================
    // FADE IN ON SCROLL
    // ============================================
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
            }
        });
    }, observerOptions);
    
    // Observe all sections
    const sections = document.querySelectorAll('section');
    sections.forEach(section => {
        section.classList.add('fade-in-section');
        observer.observe(section);
    });
    
    // ============================================
    // SCREENSHOTS CAROUSEL AUTO-LOADER
    // ============================================
    const screenshotsCarousel = document.getElementById('screenshotsCarousel');
    
    // Function to load screenshots from assets/screenshots/
    async function loadScreenshots() {
        try {
            // Actual screenshot filenames from the folder
            const screenshots = [
                'Screenshot_20260509_103352_Mindspace.jpg.jpeg',
                'Screenshot_20260509_103415_Mindspace.jpg.jpeg',
                'Screenshot_20260509_103723_Mindspace.jpg.jpeg',
                'Screenshot_20260509_104105_Mindspace.jpg.jpeg',
                'Screenshot_20260509_104124_Mindspace.jpg.jpeg',
                'Screenshot_20260509_104821_Mindspace.jpg.jpeg',
                'Screenshot_20260509_104843_Mindspace.jpg.jpeg',
                'Screenshot_20260509_104916_Mindspace.jpg.jpeg'
            ];
            
            screenshots.forEach((filename, index) => {
                const card = document.createElement('div');
                card.className = 'screenshot-card';
                card.style.animationDelay = `${index * 0.1}s`;
                
                card.innerHTML = `
                    <div class="screenshot-mockup">
                        <img src="assets/screenshots/${filename}" 
                             alt="MindSpace Screenshot ${index + 1}"
                             loading="lazy"
                             onerror="this.parentElement.parentElement.style.display='none'">
                    </div>
                `;
                
                screenshotsCarousel.appendChild(card);
            });
            
            // If no screenshots loaded, show a message
            setTimeout(() => {
                if (screenshotsCarousel.children.length === 0) {
                    screenshotsCarousel.innerHTML = `
                        <div style="width: 100%; text-align: center; padding: 3rem; color: var(--text-secondary);">
                            <p>Screenshots will appear here once added to assets/screenshots/</p>
                        </div>
                    `;
                }
            }, 1000);
        } catch (error) {
            console.log('Screenshots loading:', error);
        }
    }
    
    loadScreenshots();
    
    // ============================================
    // LAZY LOADING IMAGES
    // ============================================
    const images = document.querySelectorAll('img[loading="lazy"]');
    
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    img.src = img.dataset.src || img.src;
                    img.classList.add('loaded');
                    imageObserver.unobserve(img);
                }
            });
        });
        
        images.forEach(img => imageObserver.observe(img));
    }
    
    // ============================================
    // PARALLAX EFFECT FOR HERO BLOBS
    // ============================================
    const blobs = document.querySelectorAll('.blob');
    
    window.addEventListener('mousemove', function(e) {
        const mouseX = e.clientX / window.innerWidth;
        const mouseY = e.clientY / window.innerHeight;
        
        blobs.forEach((blob, index) => {
            const speed = (index + 1) * 10;
            const x = (mouseX - 0.5) * speed;
            const y = (mouseY - 0.5) * speed;
            
            blob.style.transform = `translate(${x}px, ${y}px)`;
        });
    });
    
    // ============================================
    // CARD TILT EFFECT
    // ============================================
    const cards = document.querySelectorAll('.about-card, .feature-card, .tech-card');
    
    cards.forEach(card => {
        card.addEventListener('mousemove', function(e) {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 20;
            const rotateY = (centerX - x) / 20;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-10px)`;
        });
        
        card.addEventListener('mouseleave', function() {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateY(0)';
        });
    });
    
    // ============================================
    // SCREENSHOT CAROUSEL SCROLL
    // ============================================
    if (screenshotsCarousel) {
        let isDown = false;
        let startX;
        let scrollLeft;
        
        screenshotsCarousel.addEventListener('mousedown', (e) => {
            isDown = true;
            screenshotsCarousel.style.cursor = 'grabbing';
            startX = e.pageX - screenshotsCarousel.offsetLeft;
            scrollLeft = screenshotsCarousel.scrollLeft;
        });
        
        screenshotsCarousel.addEventListener('mouseleave', () => {
            isDown = false;
            screenshotsCarousel.style.cursor = 'grab';
        });
        
        screenshotsCarousel.addEventListener('mouseup', () => {
            isDown = false;
            screenshotsCarousel.style.cursor = 'grab';
        });
        
        screenshotsCarousel.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - screenshotsCarousel.offsetLeft;
            const walk = (x - startX) * 2;
            screenshotsCarousel.scrollLeft = scrollLeft - walk;
        });
    }
    
    // ============================================
    // ANIMATED COUNTER (for stats if needed)
    // ============================================
    function animateCounter(element, target, duration = 2000) {
        let start = 0;
        const increment = target / (duration / 16);
        
        const timer = setInterval(() => {
            start += increment;
            if (start >= target) {
                element.textContent = target;
                clearInterval(timer);
            } else {
                element.textContent = Math.floor(start);
            }
        }, 16);
    }
    
    // ============================================
    // PERFORMANCE OPTIMIZATION
    // ============================================
    
    // Debounce function for scroll events
    function debounce(func, wait = 10) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    // Throttle function for resize events
    function throttle(func, limit = 100) {
        let inThrottle;
        return function() {
            const args = arguments;
            const context = this;
            if (!inThrottle) {
                func.apply(context, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // ============================================
    // ACCESSIBILITY ENHANCEMENTS
    // ============================================
    
    // Keyboard navigation for cards
    cards.forEach(card => {
        card.setAttribute('tabindex', '0');
        
        card.addEventListener('keypress', function(e) {
            if (e.key === 'Enter' || e.key === ' ') {
                card.click();
            }
        });
    });
    
    // Skip to main content
    const skipLink = document.createElement('a');
    skipLink.href = '#main';
    skipLink.className = 'sr-only';
    skipLink.textContent = 'Skip to main content';
    document.body.insertBefore(skipLink, document.body.firstChild);
    
    // ============================================
    // CONSOLE MESSAGE
    // ============================================
    console.log('%cMindSpace', 'font-size: 3rem; font-weight: bold; background: linear-gradient(135deg, #10b981, #06b6d4); -webkit-background-clip: text; -webkit-text-fill-color: transparent;');
    console.log('%cYour sanctuary for mental wellness', 'font-size: 1rem; color: #10b981;');
    console.log('%c\nBuilt with ❤️ for emotional support and healing', 'font-size: 0.9rem; color: #d1d5db;');
    
    // ============================================
    // APP STORE COMING SOON POPUP
    // ============================================
    const appStoreButtons = document.querySelectorAll('.download-btn');
    
    appStoreButtons.forEach(button => {
        button.addEventListener('click', function(e) {
            const storeText = this.querySelector('.download-store').textContent;
            
            // Only show popup for App Store, not for Indus Appstore
            if (storeText.includes('App Store')) {
                e.preventDefault();
                showComingSoonPopup();
            }
        });
    });
    
    function showComingSoonPopup() {
        // Create popup element
        const popup = document.createElement('div');
        popup.className = 'coming-soon-popup';
        popup.innerHTML = `
            <div class="popup-content">
                <div class="popup-icon">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                </div>
                <h3>Coming Soon!</h3>
                <p>MindSpace will be available on the Apple App Store soon. Stay tuned!</p>
            </div>
        `;
        
        document.body.appendChild(popup);
        
        // Trigger animation
        setTimeout(() => {
            popup.classList.add('show');
        }, 10);
        
        // Auto remove after 3 seconds
        setTimeout(() => {
            popup.classList.remove('show');
            setTimeout(() => {
                popup.remove();
            }, 300);
        }, 3000);
    }
    
    // ============================================
    // ANALYTICS (Optional - Add your tracking code)
    // ============================================
    // Example: Google Analytics, Plausible, etc.
    
});

// ============================================
// SERVICE WORKER (Optional - for PWA)
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Uncomment to enable service worker
        // navigator.serviceWorker.register('/sw.js');
    });
}
