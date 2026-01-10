// src/Components/Layout/Footer.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { FaFacebook, FaTwitter, FaLinkedin, FaInstagram } from 'react-icons/fa';
import hireMeLogo from '../../assets/hireme-logo.png';
import idCheckLogo from '../../assets/id-check-logo.png';
import mastercardLogo from '../../assets/mastercard-logo.png';
import visaLogo from '../../assets/visa-logo.png';
import visaSecureLogo from '../../assets/visa-secure-logo.png';

const Footer = () => {
  const socialLinks = {
    facebook: "https://facebook.com/hireme",
    twitter: "https://twitter.com/hireme",
    linkedin: "https://linkedin.com/company/hireme",
    instagram: "https://instagram.com/hireme"
  };

  return (
    <footer className="bg-blue-950 text-white">
      <div className="container mx-auto px-4 py-8 md:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8">
          {/* Company Info */}
          <div className="space-y-4 text-center sm:text-left">
            <Link to="/" className="inline-block">
              <img 
                src={hireMeLogo} 
                alt="HireMe Logo" 
                className="h-8 sm:h-10 md:h-12 w-auto mx-auto sm:mx-0" 
              />
            </Link>
            <p className="text-gray-300 text-sm md:text-base">
              Making hiring easier and more efficient for businesses in Jamaica.
            </p>
          </div>

          {/* Quick Links */}
          <div className="text-center sm:text-left">
            <h4 className="text-lg md:text-xl font-semibold mb-4 text-[#cddd3a]">Quick Links</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/about-us" className="text-gray-300 hover:text-white text-sm md:text-base">
                  About Us
                </Link>
              </li>
              <li>
                <Link to="/jobs" className="text-gray-300 hover:text-white text-sm md:text-base">
                  Find Jobs
                </Link>
              </li>
              <li>
                <Link to="/pricing" className="text-gray-300 hover:text-white text-sm md:text-base">
                  Post Jobs
                </Link>
              </li>
              <li>
                <Link to="/contact" className="text-gray-300 hover:text-white text-sm md:text-base">
                  Contact Us
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div className="text-center sm:text-left">
            <h4 className="text-lg md:text-xl font-semibold mb-4 text-[#cddd3a]">Resources</h4>
            <ul className="space-y-2">
              <li>
                <Link to="/privacy" className="text-gray-300 hover:text-white text-sm md:text-base">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link to="/terms" className="text-gray-300 hover:text-white text-sm md:text-base">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link to="/faq" className="text-gray-300 hover:text-white text-sm md:text-base">
                  FAQ
                </Link>
              </li>
              <li>
                {/* <Link to="/blog" className="text-gray-300 hover:text-white text-sm md:text-base">
                  Blog
                </Link> */}
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="text-center sm:text-left">
            <h4 className="text-lg md:text-xl font-semibold mb-4 text-[#cddd3a]">Connect With Us</h4>
            <div className="flex justify-center sm:justify-start space-x-4">
              <a href={socialLinks.facebook} 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 className="text-gray-300 hover:text-white text-xl md:text-2xl">
                <FaFacebook />
              </a>
              <a href={socialLinks.twitter} 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 className="text-gray-300 hover:text-white text-xl md:text-2xl">
                <FaTwitter />
              </a>
              <a href={socialLinks.linkedin} 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 className="text-gray-300 hover:text-white text-xl md:text-2xl">
                <FaLinkedin />
              </a>
              <a href={socialLinks.instagram} 
                 target="_blank" 
                 rel="noopener noreferrer" 
                 className="text-gray-300 hover:text-white text-xl md:text-2xl">
                <FaInstagram />
              </a>
            </div>
          </div>
        </div>

        {/* Payment and Security Logos */}
        <div className="mt-8 pt-6 border-t border-gray-700">
          <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 mb-6">
            <img 
              src={idCheckLogo} 
              alt="ID Check" 
              className="h-8 md:h-10 w-auto" 
            />
            <img 
              src={mastercardLogo} 
              alt="Mastercard" 
              className="h-8 md:h-10 w-auto" 
            />
            <img 
              src={visaLogo} 
              alt="Visa" 
              className="h-8 md:h-10 w-auto" 
            />
            <img 
              src={visaSecureLogo} 
              alt="Visa Secure" 
              className="h-8 md:h-10 w-auto" 
            />
          </div>
        </div>

        <div className="border-t border-gray-700 mt-2 pt-6 text-center">
          <p className="text-gray-300 text-sm md:text-base">
            &copy; {new Date().getFullYear()} HireMe. All rights reserved. Designed and Developed by Unicore Online.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;