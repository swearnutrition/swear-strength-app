import { Metadata } from 'next'
import Image from 'next/image'
import { InquiryForm } from './InquiryForm'

export const metadata: Metadata = {
  title: 'Swear Strength | Links',
  description: 'I fix messy technique and build strong lifters. Connect with me on social media or inquire about training.',
}

const socialLinks = [
  {
    name: 'Instagram',
    url: 'https://instagram.com/swearstrength',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    name: 'TikTok',
    url: 'https://tiktok.com/@swearstrength',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
      </svg>
    ),
  },
  {
    name: 'YouTube',
    url: 'https://www.youtube.com/@swearstrength',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    name: 'Facebook',
    url: 'https://facebook.com/swearstrength',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    name: 'LinkedIn',
    url: 'https://www.linkedin.com/in/heatherswear/',
    icon: (
      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
      </svg>
    ),
  },
]

export default function LinksPage() {
  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <div className="max-w-md mx-auto px-4 py-12">
        {/* Logo & Header */}
        <div className="text-center mb-8">
          <div className="relative w-32 h-32 mx-auto mb-4">
            <Image
              src="/icon.png"
              alt="Swear Strength"
              fill
              className="object-contain drop-shadow-[0_0_15px_rgba(168,85,247,0.5)]"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
            Swear Strength
          </h1>
          <p className="text-slate-300 text-lg mb-1">
            I fix messy technique and build strong lifters.
          </p>
          <p className="text-slate-500 text-sm">
            Rancho Cucamonga, CA
          </p>
        </div>

        {/* Inquiry Form */}
        <div className="mb-8">
          <InquiryForm />
        </div>

        {/* LyteBite Sponsor Card */}
        <div className="mb-8 p-5 rounded-2xl bg-slate-900/50 border border-slate-800 hover:border-cyan-500/50 transition-all">
          <div className="flex items-center justify-center mb-4">
            <div className="relative w-48 h-16">
              <Image
                src="/lytebite-logo.png"
                alt="LyteBite - Clean Eats & Meal Prep"
                fill
                className="object-contain"
              />
            </div>
          </div>
          <p className="text-slate-300 text-sm mb-3 text-center">
            Life&apos;s unpredictable. Your nutrition doesn&apos;t have to be. Fresh meals, 7 days a week.
          </p>
          <p className="text-slate-500 text-xs mb-3 text-center">
            Glendora, CA · Upland, CA · Chandler, AZ
          </p>
          <p className="text-cyan-400 text-sm font-semibold mb-3 text-center">
            Use code SWEAR for a discount!
          </p>
          <a
            href="https://www.lytebite.com"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-white font-medium text-center transition-all hover:scale-[1.02]"
          >
            Order Now
          </a>
        </div>

        {/* Social Links */}
        <div className="flex justify-center gap-4">
          {socialLinks.map((link) => (
            <a
              key={link.name}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={link.name}
              className="flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white transition-all hover:scale-110 hover:shadow-lg hover:shadow-purple-500/25"
            >
              {link.icon}
            </a>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-slate-600 text-sm mt-12">
          swearstrength.com
        </p>
      </div>
    </div>
  )
}
