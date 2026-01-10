import React from 'react';
import { FaLightbulb, FaRocket, FaUsers } from 'react-icons/fa';
import aboutBanner from '../assets/about-banner.png';

const Hero = () => {
  return (
    <header
  className="max-w-full light text-white bg-center bg-cover bg-fixed"
  style={{
    backgroundImage: `url(${aboutBanner})`,
    backgroundRepeat: "no-repeat",
    backgroundSize: 'cover',
    backgroundPosition: "center 20%" // Adjust this value (0% = top, 50% = center, 100% = bottom)
  }}
>
      <div className="py-32 md:py-32 bg-black bg-opacity-50 dark:bg-opacity-70">
        <div className="container px-4 m-auto">
          <div className="grid grid-cols-12">
            <div className="col-span-12 text-center">
              <div className="text-center">
                <div className="w-3/4 m-auto">
                  <p style={{ lineHeight: "1.5", color: "#cddd3a" }} 
                     className="text-5xl text-center font-extrabold uppercase">
                    Empowering
                  </p>
                  <p style={{ lineHeight: "1.5", color: "#fff" }} 
                     className="text-5xl text-center font-extrabold uppercase">
                    Employers and job seekers with better hiring strategies
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

const AboutUs = () => {
  return (
    <section className="max-w-full bg-white dark:bg-[#0b1727] text-zinc-900 dark:text-white">
      <Hero />
      <div className="container mx-auto px-4 sm:py-24 py-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
          {/* Left Column - Text Content */}
          <div>
            <h2 className="text-4xl font-bold mb-6" style={{ color: "#263571" }}>
              About Us
            </h2>
            <div className="space-y-6 text-lg">
              <p>
                HireMe is Jamaica's first hiring platform that connects employers and job candidates 
                in a fast and effective way. We say no to inefficient processes. No to job postings 
                and milling through hundreds of unqualified applicants to find that ideal candidate. 
                Instead, employers can simplify the decision-making process to find not only suitable 
                candidates but more of them. Job seekers can showcase more than just their resumé.
              </p>
              <p>
                Our process allows you to enjoy a less restrictive recruitment and hiring process. 
                In doing so, both employers and candidates can move from recruitment to offer letter faster.
              </p>
              <p>
                We have been on both sides of the coin – trying to find a job based on a bland resumé 
                and recruiting the right candidates based on similar resumés. Arising from these frustrations, 
                we have made the most effective online employment solution. Hire Me is the platform that 
                accounts for the needs and challenges of both employers and job seekers.
              </p>
            </div>
          </div>

          {/* Right Column - Feature Box */}
          <div className="bg-blue-600 rounded-lg p-8 text-white h-full">
            <h3 className="text-3xl font-bold text-center mb-8">
              Discover More About Our Innovative Hiring Solutions
            </h3>
            
            {/* Features Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="bg-blue-500 hover:bg-blue-400 transition-colors p-4 rounded-full inline-block mb-4">
                  <FaLightbulb className="w-12 h-12" />
                </div>
                <p className="font-semibold">Innovative Solutions</p>
              </div>
              
              <div className="text-center">
                <div className="bg-blue-500 hover:bg-blue-400 transition-colors p-4 rounded-full inline-block mb-4">
                  <FaUsers className="w-12 h-12" />
                </div>
                <p className="font-semibold">Connect with Us</p>
              </div>
              
              <div className="text-center">
                <div className="bg-blue-500 hover:bg-blue-400 transition-colors p-4 rounded-full inline-block mb-4">
                  <FaRocket className="w-12 h-12" />
                </div>
                <p className="font-semibold">Rapid Growth</p>
              </div>
            </div>

            {/* Additional Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
              <div className="bg-blue-500 p-6 rounded-lg">
                <h4 className="text-xl font-bold mb-2">Our Mission</h4>
                <p>To revolutionize the hiring process in Jamaica through innovative technology</p>
              </div>
              <div className="bg-blue-500 p-6 rounded-lg">
                <h4 className="text-xl font-bold mb-2">Our Vision</h4>
                <p>To be the leading employment platform connecting talent with opportunities</p>
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mt-16">
          <div className="text-center">
            <div className="text-4xl font-bold mb-2" style={{ color: "#cddd3a" }}>5000+</div>
            <p className="text-lg">Active Users</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2" style={{ color: "#cddd3a" }}>1000+</div>
            <p className="text-lg">Companies</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2" style={{ color: "#cddd3a" }}>2000+</div>
            <p className="text-lg">Jobs Posted</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold mb-2" style={{ color: "#cddd3a" }}>95%</div>
            <p className="text-lg">Success Rate</p>
          </div>
        </div>

        {/* Core Values Section */}
        <div className="mt-16">
          <h3 className="text-3xl font-bold text-center mb-8" style={{ color: "#263571" }}>
            Our Core Values
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-xl font-bold mb-4" style={{ color: "#cddd3a" }}>Innovation</h4>
              <p>Constantly improving our platform to provide the best hiring experience</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-xl font-bold mb-4" style={{ color: "#cddd3a" }}>Efficiency</h4>
              <p>Streamlining the hiring process to save time and resources</p>
            </div>
            <div className="bg-gray-50 p-6 rounded-lg">
              <h4 className="text-xl font-bold mb-4" style={{ color: "#cddd3a" }}>Transparency</h4>
              <p>Building trust through open and honest communication</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default AboutUs;