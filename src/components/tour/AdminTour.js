import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/router'
import { tourSteps } from './tourSteps'
import { tourTranslations } from './tourTranslations'

export default function AdminTour({
  userRole = 'SUPER_ADMIN',
  isSuperAdmin = false,
  userId = 'default',
  isOpen = false,
  onClose = () => {}
}) {
  const router = useRouter()
  const [active, setActive] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [language, setLanguage] = useState('en')
  const [targetRect, setTargetRect] = useState(null)
  const [navigating, setNavigating] = useState(false)
  const [showWelcomeModal, setShowWelcomeModal] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const resizeObserverRef = useRef(null)

  // Initialize language from localStorage or default
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedLang = localStorage.getItem('smart_farmer_admin_lang') || 'en'
      setLanguage(savedLang)
    }
  }, [])

  // Save language changes
  const changeLanguage = (lang) => {
    setLanguage(lang)
    if (typeof window !== 'undefined') {
      localStorage.setItem('smart_farmer_admin_lang', lang)
    }
  }

  // Filter tour steps based on user permissions
  const authorizedSteps = tourSteps.filter(step => {
    if (isSuperAdmin) return true
    return step.requiredRoles.includes(userRole)
  })

  // Storage key for completion tracking per user and role
  const completionKey = `smart_farmer_tour_completed_${userId}_${userRole}`

  // Check if tour should run automatically on first login across any admin page
  useEffect(() => {
    if (typeof window === 'undefined') return

    // Check completion status
    const isCompleted = localStorage.getItem(completionKey) === 'true'

    // Auto start welcome modal if first time and loaded on any admin page (not login/blocked)
    const isAdminPage = router.pathname.startsWith('/admin') &&
                        router.pathname !== '/admin/login' &&
                        router.pathname !== '/admin/blocked'

    if (!isCompleted && isAdminPage && !isOpen && !active) {
      const timer = setTimeout(() => {
        setShowWelcomeModal(true)
      }, 1200)
      return () => clearTimeout(timer)
    }
  }, [router.pathname, completionKey, isOpen, active])

  // Handle explicit isOpen prop (e.g. triggered from header button or profile menu)
  useEffect(() => {
    if (isOpen) {
      setShowWelcomeModal(false)
      setActive(true)
      setStepIndex(0)
    }
  }, [isOpen])

  // Current step metadata
  const currentStep = authorizedSteps[stepIndex] || authorizedSteps[0]
  const translations = tourTranslations[language] || tourTranslations.en
  const totalSteps = authorizedSteps.length

  // Calculate unique modules for progress indicators
  const uniqueModules = [...new Set(authorizedSteps.map(s => s.module))]
  const currentModuleIndex = uniqueModules.indexOf(currentStep?.module) + 1
  const totalModules = uniqueModules.length

  // Helper to format string variables
  const formatText = (text, vars = {}) => {
    if (!text) return ''
    let result = text
    Object.keys(vars).forEach(key => {
      result = result.replace(new RegExp(`\\{${key}\\}`, 'g'), vars[key])
    })
    return result
  }

  // Update highlight bounding box and auto-scroll
  const updateTargetRect = useCallback(() => {
    if (!active || !currentStep) return

    const selector = currentStep.targetSelector
    const element = document.querySelector(selector)

    if (element) {
      // Auto-scroll element into view smoothly
      element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })

      const rect = element.getBoundingClientRect()
      setTargetRect({
        top: rect.top + window.scrollY,
        left: rect.left + window.scrollX,
        width: rect.width,
        height: rect.height,
        viewportTop: rect.top,
        viewportLeft: rect.left
      })

      calculateTooltipPosition(rect, currentStep.placement)
    } else {
      // Element not found - default fallback position centered on screen
      setTargetRect(null)
      setTooltipPos({
        top: window.innerHeight / 2 - 150,
        left: Math.max(20, window.innerWidth / 2 - 220)
      })
    }
  }, [active, currentStep])

  // Compute smart tooltip positioning
  const calculateTooltipPosition = (rect, placement = 'bottom') => {
    const margin = 16
    const tooltipWidth = Math.min(420, window.innerWidth - 32)
    const tooltipHeight = 260

    let top = 0
    let left = 0

    const vTop = rect.top
    const vLeft = rect.left
    const vWidth = rect.width
    const vHeight = rect.height

    if (placement.startsWith('bottom')) {
      top = vTop + vHeight + margin
      left = vLeft + vWidth / 2 - tooltipWidth / 2
    } else if (placement.startsWith('top')) {
      top = vTop - tooltipHeight - margin
      left = vLeft + vWidth / 2 - tooltipWidth / 2
    } else if (placement.startsWith('left')) {
      top = vTop + vHeight / 2 - tooltipHeight / 2
      left = vLeft - tooltipWidth - margin
    } else if (placement.startsWith('right')) {
      top = vTop + vHeight / 2 - tooltipHeight / 2
      left = vLeft + vWidth + margin
    } else {
      top = vTop + vHeight + margin
      left = vLeft
    }

    // Adjust for right viewport bounds
    if (left + tooltipWidth > window.innerWidth - 16) {
      left = window.innerWidth - tooltipWidth - 16
    }
    // Adjust for left viewport bounds
    if (left < 16) left = 16

    // Adjust for top/bottom bounds
    if (top < 16) top = vTop + vHeight + margin
    if (top + tooltipHeight > window.innerHeight - 16) {
      top = Math.max(16, vTop - tooltipHeight - margin)
    }

    setTooltipPos({ top, left })
  }

  // Monitor route changes and step updates
  useEffect(() => {
    if (!active || !currentStep) return

    if (router.pathname !== currentStep.pageRoute) {
      setNavigating(true)
      router.push(currentStep.pageRoute).then(() => {
        setTimeout(() => {
          setNavigating(false)
          updateTargetRect()
        }, 400)
      }).catch(() => setNavigating(false))
    } else {
      setNavigating(false)
      const timer = setTimeout(updateTargetRect, 200)
      return () => clearTimeout(timer)
    }
  }, [stepIndex, active, currentStep, router, updateTargetRect])

  // Recalculate on scroll & resize
  useEffect(() => {
    if (!active) return

    const handleScrollResize = () => {
      updateTargetRect()
    }

    window.addEventListener('resize', handleScrollResize)
    window.addEventListener('scroll', handleScrollResize, true)

    return () => {
      window.removeEventListener('resize', handleScrollResize)
      window.removeEventListener('scroll', handleScrollResize, true)
    }
  }, [active, updateTargetRect])

  // Keyboard Navigation
  useEffect(() => {
    if (!active) return

    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'Enter') {
        e.preventDefault()
        handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        handleBack()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleSkipTour()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [active, stepIndex, totalSteps])

  // Next Step
  const handleNext = () => {
    if (stepIndex < totalSteps - 1) {
      setStepIndex(prev => prev + 1)
    } else {
      handleFinish()
    }
  }

  // Back Step
  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(prev => prev - 1)
    }
  }

  // Skip current feature module and advance to next module
  const handleSkipFeature = () => {
    const currentModule = currentStep.module
    const nextStepIndex = authorizedSteps.findIndex((step, idx) => idx > stepIndex && step.module !== currentModule)

    if (nextStepIndex !== -1) {
      setStepIndex(nextStepIndex)
    } else {
      handleFinish()
    }
  }

  // Finish tour and save completion
  const handleFinish = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(completionKey, 'true')
    }
    setActive(false)
    setShowWelcomeModal(false)
    onClose()
  }

  // Skip all tour steps
  const handleSkipTour = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(completionKey, 'true')
    }
    setActive(false)
    setShowWelcomeModal(false)
    onClose()
  }

  // Start tour from welcome modal
  const startTourFromWelcome = () => {
    setShowWelcomeModal(false)
    setActive(true)
    setStepIndex(0)
  }

  // Render Step Translations
  const stepText = currentStep ? translations.steps[currentStep.stepKey] || tourTranslations.en.steps[currentStep.stepKey] : null
  const moduleName = currentStep ? translations.modules[currentStep.module] || currentStep.module : ''

  if (!active && !showWelcomeModal) return null

  return (
    <>
      {/* Welcome Modal on First Login */}
      {showWelcomeModal && (
        <div className="tour-welcome-overlay">
          <div className="tour-welcome-modal card border-0 shadow-2xl rounded-3 animate-fade-in">
            <div className="bg-gradient-primary text-white p-4 text-center rounded-top position-relative">
              <div className="tour-badge-icon mb-3 mx-auto">
                <i className="bi bi-compass-fill fs-1"></i>
              </div>
              <h4 className="fw-bold mb-1">{translations.welcomeTitle}</h4>
              <span className="badge bg-white text-primary rounded-pill px-3 py-1">
                {formatText(translations.roleTag, { role: userRole })}
              </span>
            </div>

            <div className="p-4">
              <p className="text-secondary leading-relaxed mb-4" style={{ fontSize: '15px' }}>
                {formatText(translations.welcomeDesc, { role: userRole })}
              </p>

              {/* Language Selector */}
              <div className="d-flex align-items-center justify-content-between p-3 bg-light rounded-3 mb-4">
                <div className="d-flex align-items-center gap-2">
                  <i className="bi bi-translate text-primary fs-5"></i>
                  <span className="fw-medium text-dark small">{translations.language}:</span>
                </div>
                <div className="btn-group btn-group-sm">
                  <button
                    className={`btn ${language === 'en' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => changeLanguage('en')}
                  >
                    🇬🇧 English
                  </button>
                  <button
                    className={`btn ${language === 'si' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => changeLanguage('si')}
                  >
                    🇱🇰 සිංහල
                  </button>
                  <button
                    className={`btn ${language === 'ta' ? 'btn-primary' : 'btn-outline-secondary'}`}
                    onClick={() => changeLanguage('ta')}
                  >
                    🇱🇰 தமிழ்
                  </button>
                </div>
              </div>

              <div className="d-flex align-items-center justify-content-end gap-2">
                <button
                  className="btn btn-link text-muted text-decoration-none px-3"
                  onClick={handleSkipTour}
                >
                  {translations.maybeLaterBtn}
                </button>
                <button
                  className="btn btn-primary px-4 py-2 rounded-2 fw-semibold d-flex align-items-center gap-2 shadow-sm"
                  onClick={startTourFromWelcome}
                >
                  <i className="bi bi-play-circle-fill"></i>
                  {translations.startTourBtn}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Tour Spotlight Overlay */}
      {active && (
        <div className="tour-backdrop">
          {/* Spotlight Highlight Box around Target */}
          {targetRect && (
            <div
              className="tour-spotlight-box"
              style={{
                top: `${targetRect.viewportTop - 6}px`,
                left: `${targetRect.viewportLeft - 6}px`,
                width: `${targetRect.width + 12}px`,
                height: `${targetRect.height + 12}px`
              }}
            >
              <div className="tour-spotlight-pulse"></div>
            </div>
          )}

          {/* Contextual Tooltip */}
          <div
            className="tour-tooltip card border-0 shadow-2xl rounded-3"
            style={{
              position: 'fixed',
              top: `${tooltipPos.top}px`,
              left: `${tooltipPos.left}px`,
              width: '420px',
              maxWidth: 'calc(100vw - 32px)',
              zIndex: 1000000
            }}
          >
            {/* Tooltip Header Bar */}
            <div className="card-header bg-dark text-white d-flex align-items-center justify-content-between px-3 py-2 border-0 rounded-top">
              <div className="d-flex align-items-center gap-2">
                <span className="badge bg-primary text-white rounded-pill px-2.5 py-1" style={{ fontSize: '11px' }}>
                  {moduleName}
                </span>
                <small className="text-gray-300 fw-medium" style={{ fontSize: '11px' }}>
                  {formatText(translations.stepCount, { current: stepIndex + 1, total: totalSteps })}
                </small>
              </div>

              <div className="d-flex align-items-center gap-2">
                {/* Language Picker Dropdown */}
                <select
                  className="form-select form-select-sm bg-secondary text-white border-0 py-0 px-2"
                  value={language}
                  onChange={(e) => changeLanguage(e.target.value)}
                  style={{ fontSize: '11px', height: '24px', cursor: 'pointer' }}
                >
                  <option value="en">🇬🇧 EN</option>
                  <option value="si">🇱🇰 SI</option>
                  <option value="ta">🇱🇰 TA</option>
                </select>

                <button
                  className="btn btn-sm text-white-50 p-0 hover-white border-0"
                  onClick={handleSkipTour}
                  title={translations.skipTour}
                  style={{ outline: 'none', background: 'transparent' }}
                >
                  <i className="bi bi-x-lg fs-6"></i>
                </button>
              </div>
            </div>

            {/* Progress Bar Indicator */}
            <div className="progress rounded-0" style={{ height: '4px', background: 'rgba(0,0,0,0.1)' }}>
              <div
                className="progress-bar bg-primary transition-all duration-300"
                style={{ width: `${((stepIndex + 1) / totalSteps) * 100}%` }}
              ></div>
            </div>

            {/* Tooltip Body */}
            <div className="card-body p-3.5">
              {navigating ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary spinner-border-sm mb-2" role="status"></div>
                  <p className="text-muted small mb-0">Navigating to feature section...</p>
                </div>
              ) : (
                <>
                  <h6 className="fw-bold text-dark mb-2 d-flex align-items-center justify-content-between" style={{ fontSize: '15px' }}>
                    <span>{stepText?.title}</span>
                  </h6>

                  <p className="text-secondary small mb-3 leading-relaxed" style={{ fontSize: '13px', lineHeight: '1.5' }}>
                    {stepText?.description}
                  </p>

                  {/* Safe Demonstration Notice Box */}
                  {currentStep?.hasSafeDemo && (
                    <div className="tour-safe-notice p-2.5 rounded-2 bg-warning bg-opacity-10 border border-warning border-opacity-25 mb-3">
                      <div className="d-flex align-items-start gap-2">
                        <i className="bi bi-shield-lock-fill text-warning fs-6 mt-0.5"></i>
                        <div style={{ fontSize: '12px' }} className="text-dark">
                          <strong>{translations.safeModeBadge}:</strong>
                          <div className="text-secondary mt-0.5">{stepText?.safeDemo}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Footer Controls Bar */}
                  <div className="d-flex align-items-center justify-content-between pt-2 border-top">
                    <div className="d-flex align-items-center gap-1">
                      <button
                        className="btn btn-sm btn-outline-secondary px-2.5 py-1 text-dark"
                        onClick={handleBack}
                        disabled={stepIndex === 0}
                        style={{ fontSize: '12px' }}
                      >
                        <i className="bi bi-chevron-left me-1"></i>
                        {translations.back}
                      </button>

                      <button
                        className="btn btn-sm btn-link text-muted text-decoration-none px-2"
                        onClick={handleSkipFeature}
                        style={{ fontSize: '11px' }}
                      >
                        {translations.skipFeature}
                      </button>
                    </div>

                    <div className="d-flex align-items-center gap-2">
                      <button
                        className="btn btn-sm btn-primary px-3 py-1 fw-medium d-flex align-items-center gap-1 shadow-sm"
                        onClick={handleNext}
                        style={{ fontSize: '12px' }}
                      >
                        {stepIndex === totalSteps - 1 ? (
                          <>
                            <span>{translations.finish}</span>
                            <i className="bi bi-check-circle-fill"></i>
                          </>
                        ) : (
                          <>
                            <span>{translations.next}</span>
                            <i className="bi bi-chevron-right"></i>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tour Custom CSS Styles */}
      <style jsx global>{`
        .tour-welcome-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background-color: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(6px);
          z-index: 999999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
        }

        .tour-welcome-modal {
          width: 520px;
          max-width: 100%;
          background: #ffffff;
          overflow: hidden;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .tour-badge-icon {
          width: 64px;
          height: 64px;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .tour-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(15, 23, 42, 0.55);
          pointer-events: auto;
          z-index: 999998;
          transition: all 0.2s ease;
        }

        .tour-spotlight-box {
          position: absolute;
          border-radius: 8px;
          box-shadow: 0 0 0 9999px rgba(15, 23, 42, 0.65), 0 0 20px rgba(79, 70, 229, 0.8);
          border: 2px solid #4f46e5;
          pointer-events: none;
          z-index: 999999;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tour-spotlight-pulse {
          position: absolute;
          inset: -4px;
          border-radius: 10px;
          border: 2px solid rgba(99, 102, 241, 0.6);
          animation: tourPulse 2s infinite;
        }

        @keyframes tourPulse {
          0% {
            transform: scale(1);
            opacity: 0.8;
          }
          50% {
            transform: scale(1.03);
            opacity: 0.3;
          }
          100% {
            transform: scale(1);
            opacity: 0.8;
          }
        }

        .tour-tooltip {
          background: #ffffff;
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 10px 10px -5px rgba(0, 0, 0, 0.08);
          animation: tooltipFadeIn 0.25s ease-out;
        }

        @keyframes tooltipFadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in {
          animation: modalFadeIn 0.3s ease-out;
        }

        @keyframes modalFadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </>
  )
}
