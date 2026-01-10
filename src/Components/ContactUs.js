import React, { useState } from "react";
import { getDatabase, ref, push } from 'firebase/database';
import { app } from '../firebase';
import contactBanner from '../assets/contact-banner.png';
import contactImage from '../assets/contact-image.png';
import { toast } from "react-toastify";

const database = getDatabase(app);

const ContactForm = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });
  const [validated, setValidated] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    setValidated(false);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    
    if (form.checkValidity() === false) {
      event.stopPropagation();
      setValidated(true);
      return;
    }

    setLoading(true);

    try {
      // Add timestamp and subject to the message
      const messageData = {
        ...formData,
        subject: `Contact Form Inquiry from ${formData.name}`,
        timestamp: new Date().toISOString(),
        status: 'unread'
      };

      // Push the message to Firebase
      const messagesRef = ref(database, 'contact_messages');
      await push(messagesRef, messageData);

      // Show success message
      toast.success("Message sent successfully! We'll get back to you soon.");

      // Reset form
      setFormData({ name: '', email: '', phone: '', message: '' });
      setValidated(false);
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      className={`md:pr-12 ${validated ? 'was-validated' : ''}`}
      noValidate
      onSubmit={handleSubmit}
    >
      <div className="mb-4">
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={`min-h-[48px] leading-[48px] bg-[#263571] text-white dark:bg-[#cddd3a] border border-transparent rounded-xl focus:outline-none focus:border focus:border-[#86b7fe] w-full px-5 ${
            validated && !formData.name ? 'border-red-500' : ''
          }`}
          placeholder="Enter Name"
          required
          disabled={loading}
        />
        {validated && !formData.name && (
          <div className="text-red-500 mt-1 text-sm">Please enter your name</div>
        )}
      </div>
      <div className="mb-4">
        <input
          type="email"
          name="email"
          value={formData.email}
          onChange={handleChange}
          className={`min-h-[48px] leading-[48px] bg-[#263571] text-white dark:bg-[#1B2635] border border-transparent rounded-xl focus:outline-none focus:border focus:border-[#86b7fe] w-full px-5 ${
            validated && !formData.email ? 'border-red-500' : ''
          }`}
          placeholder="Enter Email"
          required
          disabled={loading}
        />
        {validated && !formData.email && (
          <div className="text-red-500 mt-1 text-sm">Please enter a valid email</div>
        )}
      </div>
      <div className="mb-4">
        <input
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={handleChange}
          className={`min-h-[48px] leading-[48px] bg-[#263571] text-white dark:bg-[#1B2635] border border-transparent rounded-xl focus:outline-none focus:border focus:border-[#86b7fe] w-full px-5 ${
            validated && !formData.phone ? 'border-red-500' : ''
          }`}
          placeholder="Enter Phone"
          required
          disabled={loading}
        />
        {validated && !formData.phone && (
          <div className="text-red-500 mt-1 text-sm">Please enter your phone number</div>
        )}
      </div>
      <div className="mb-4">
        <textarea
          name="message"
          value={formData.message}
          onChange={handleChange}
          className={`min-h-[48px] leading-[48px] bg-[#263571] text-white dark:bg-[#1B2635] border border-transparent rounded-xl focus:outline-none focus:border focus:border-[#86b7fe] w-full px-5 ${
            validated && !formData.message ? 'border-red-500' : ''
          }`}
          placeholder="Enter Message"
          rows="4"
          required
          disabled={loading}
        ></textarea>
        {validated && !formData.message && (
          <div className="text-red-500 mt-1 text-sm">Please enter your message</div>
        )}
      </div>
      <div className="text-end">
        <button
          type="submit"
          className="bg-blue-900 text-white hover:bg-opacity-90 px-10 py-3 rounded-md mb-4 transition duration-300 disabled:opacity-50"
          disabled={loading}
        >
          {loading ? 'Sending...' : 'Send'}
        </button>
      </div>
    </form>
  );
};

const Hero = () => {
  return (
    <header
      className="max-w-full light text-white bg-center bg-cover bg-fixed"
      style={{
        backgroundImage: `url(${contactBanner})`,
        backgroundRepeat: "no-repeat",
        backgroundSize: 'cover',
        backgroundPosition: "center top"
      }}
    >
      <div className="py-32 md:py-32 bg-black bg-opacity-50 dark:bg-opacity-70">
        <div className="container px-4 m-auto">
          <div className="grid grid-cols-12">
            <div className="col-span-12 text-center">
              <div className="text-center">
                <div className="w-3/4 m-auto">
                  <p 
                    style={{ lineHeight: "1.5", color: "#cddd3a" }} 
                    className="text-5xl text-center font-extrabold uppercase"
                  >
                    Hire Me is Revolutionizing
                  </p>
                  <p 
                    style={{ lineHeight: "1.5", color: "#fff" }} 
                    className="text-5xl text-center font-extrabold uppercase"
                  >
                    Traditional Resume-only Recruitment Process
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

const ContactInfo = () => {
  // Pre-defined email content
  const emailSubject = encodeURIComponent("Inquiry from HireMeJA Website");
  const emailBody = encodeURIComponent(`Hello HireMeJA Team,

I am reaching out regarding:
[ ] Job posting assistance
[ ] Account support
[ ] Partnership opportunity
[ ] General inquiry
[ ] Other: _______________

Message:


Best regards,
[Your Name]
[Your Contact Information]`);

  const mailtoLink = `mailto:info@hiremeja.com?subject=${emailSubject}&body=${emailBody}`;

  return (
    <div className="bg-[#263571] text-white p-6 rounded-xl mb-8">
      <h3 className="text-xl font-bold mb-4">Contact Information</h3>
      <div className="space-y-4">
        <p>
          <span className="font-bold">Address:</span><br />
          Kingston, Jamaica
        </p>
        <p>
          <span className="font-bold">Email:</span><br />
          <a 
            href={mailtoLink}
            className="text-[#cddd3a] hover:text-white underline hover:no-underline transition-colors duration-200"
            title="Click to send us an email"
          >
            info@hiremeja.com
          </a>
        </p>
        <p>
          <span className="font-bold">Hours:</span><br />
          Monday - Friday: 9:00 AM - 5:00 PM
        </p>
      </div>
    </div>
  );
};

const FAQ = () => {
  return (
    <div className="bg-gray-100 p-6 rounded-xl">
      <h3 className="text-xl font-bold mb-4 text-[#263571]">FAQs</h3>
      <div className="space-y-4 text-gray-700">
        <div>
          <h4 className="font-bold mb-2">How quickly will I receive a response?</h4>
          <p>We aim to respond to all inquiries within 24 business hours.</p>
        </div>
        <div>
          <h4 className="font-bold mb-2">What information should I include?</h4>
          <p>Please provide as much detail as possible about your inquiry to help us assist you better.</p>
        </div>
        <div>
          <h4 className="font-bold mb-2">Can I contact you directly via email?</h4>
          <p>Yes. Click on our email address to open your mail client with a pre-filled template, or use the contact form for web-based submission.</p>
        </div>
      </div>
    </div>
  );
};

const ContactUs = () => {
  return (
    <section className="max-w-full bg-white text-white overflow-hidden text-left">
      <Hero />
      <div className="container px-4 relative m-auto">
        <div className="grid grid-cols-12 py-20">
          <div className="col-span-12 lg:col-span-6 mb-4 lg:mb-0">
            <div className="h-full flex items-center">
              <img
                src={contactImage}
                alt="Contact HireMe"
                className="max-w-full h-auto relative z-[2] rounded-tr-[100px] rounded-br rounded-bl-[100px] mx-auto"
              />
            </div>
          </div>

          <div className="col-span-12 lg:col-span-6 xl:col-span-5 px-6 relative">
            <div className="absolute top-0 left-0 lg:-left-[20%] right-0 bottom-0 bg-[#cddd3a] dark:bg-[#162231] rounded-tl rounded-tr-[30px] rounded-br-[150px] rounded-bl-[50px]"></div>

            <div className="relative rounded my-12 py-6">
              <div className="mb-12">
                <h2 className="text-2xl leading-none font-bold md:text-[45px] mb-4">
                  Contact Us
                </h2>
              </div>
              <ContactForm />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-12">
          <ContactInfo />
          <FAQ />
        </div>
      </div>
    </section>
  );
};

export default ContactUs;