import React, { useState } from 'react';
import { FaChevronDown, FaChevronUp } from 'react-icons/fa';

const FAQCategory = ({ title, faqs, openIndex, setOpenIndex, startIndex }) => (
  <div className="mb-8">
    <h2 className="text-xl font-bold text-blue-950 mb-4">{title}</h2>
    <div className="bg-white rounded-lg shadow-sm">
      {faqs.map((faq, index) => (
        <FAQItem
          key={startIndex + index}
          question={faq.question}
          answer={faq.answer}
          isOpen={startIndex + index === openIndex}
          onClick={() => setOpenIndex(startIndex + index === openIndex ? -1 : startIndex + index)}
        />
      ))}
    </div>
  </div>
);

const FAQItem = ({ question, answer, isOpen, onClick }) => (
  <div className="border-b border-gray-200 last:border-0">
    <button
      className="w-full py-6 px-6 text-left flex justify-between items-center hover:text-blue-950 focus:outline-none"
      onClick={onClick}
    >
      <span className="font-semibold text-lg pr-8">{question}</span>
      {isOpen ? <FaChevronUp className="flex-shrink-0" /> : <FaChevronDown className="flex-shrink-0" />}
    </button>
    {isOpen && (
      <div className="pb-6 px-6 text-gray-600">
        {answer}
      </div>
    )}
  </div>
);

const FAQ = () => {
  const [openIndex, setOpenIndex] = useState(0);

  const faqCategories = [
    {
      title: "Getting Started",
      faqs: [
        {
          question: "How do I create an account on HireMe?",
          answer: "Creating an account is simple. Click 'Sign Up' and choose between an employer or job seeker account. Fill in your basic information, verify your email, and complete your profile. The entire process takes just a few minutes."
        },
        {
          question: "Is it free to create an account?",
          answer: "Yes, creating an account is completely free for job seekers. Employers can create a basic account for free but will need to subscribe to a package to post jobs and access advanced features."
        },
        {
          question: "What documents do I need to register?",
          answer: "Job seekers should have their resume and any relevant certificates ready to upload. Employers should prepare their company registration details and any necessary business documentation."
        },
        {
          question: "Can I have both an employer and job seeker account?",
          answer: "No, you'll need to choose either an employer or job seeker account. Each email address can only be associated with one account type."
        }
      ]
    },
    {
      title: "For Job Seekers",
      faqs: [
        {
          question: "How do I optimize my profile for better visibility?",
          answer: "Include a professional photo, detailed work history, education, and skills. Use relevant keywords in your profile, keep your information up-to-date, and regularly update your availability status."
        },
        {
          question: "Can I apply for multiple jobs at once?",
          answer: "Yes, you can apply for as many jobs as you wish. However, we recommend tailoring your application and resume for each position to increase your chances of success."
        },
        {
          question: "How do I track my job applications?",
          answer: "Access your dashboard and click on 'Applied Jobs' to see all your applications, their status, and any messages from employers."
        },
        {
          question: "What should I do if I need to update my resume after applying?",
          answer: "You can update your resume at any time through your profile. However, already submitted applications will retain the version of your resume that was current at the time of application."
        },
        {
          question: "Can I save a job to look at later?",
          answer: "Yes, go to the job search page, set your preferred filters, and click 'Save' on the Job. It will be saved to your favourite jobs in your candidate console dashboard."
        },
        {
          question: "I submitted an application and it says \"Pending Review\", what does this mean?",
          answer: "Pending review on your application means that you application is waiting to be reviewed by the Employer."
        }
      ]
    },
    {
      title: "For Employers",
      faqs: [
        {
          question: "What are the benefits of the different subscription packages?",
          answer: "Our packages vary in features such as number of job posts, resume database access, and priority listing. Visit our Pricing page for a detailed comparison of all available packages."
        },
        {
          question: "How do I post a job effectively?",
          answer: "Use clear job titles, detailed descriptions, and specific requirements. Include salary range, benefits, and location information. Our system will guide you through creating an optimized job posting."
        },
        {
          question: "Can I edit a job posting after it's published?",
          answer: "Yes, you can edit job postings at anytime. However, significant changes may require re-approval from our moderation team."
        },
        {
          question: "How do I manage multiple job postings?",
          answer: "Your dashboard provides a comprehensive view of all your job postings. You can sort by status, date, or number of applications, and manage them individually or in bulk."
        },
        {
          question: "What tools are available for screening candidates?",
          answer: "You can use our built-in screening questions, skills assessments, and resume parsing tools. You can also create custom application forms and rating systems for candidates."
        }
      ]
    },
    {
      title: "Applications and Communication",
      faqs: [
        {
          question: "What happens after I submit an application?",
          answer: "You can track the application status in your dashboard. You will see either Pending, Reviewed, Shortlisted, Rejected or Hired. The Employer may also contact you via other means outside of the platform to continue discussions."
        },
        {
          question: "Can I withdraw an application?",
          answer: "Yes, you can withdraw applications through your dashboard. The employer will be notified, and the position will be marked as 'withdrawn' in your applications list."
        },
        {
          question: "How do I schedule interviews?",
          answer: "Employers will handle interview requests."
        }
      ]
    },
    {
      title: "Technical Support and Security",
      faqs: [
        {
          question: "What should I do if I forget my password?",
          answer: "Click 'Forgot Password' on the login page and follow the instructions sent to your registered email. For security, password reset links expire after 24 hours."
        },
        {
          question: "How secure is my personal information?",
          answer: "We use industry-standard encryption and security measures to protect your data. Your information is stored securely and only shared according to our Privacy Policy."
        },
        {
          question: "Can I delete or private my account?",
          answer: "Yes, you can delete or private your account through your profile dashboard."
        },
        {
          question: "What browsers are supported?",
          answer: "We support the latest versions of Chrome, Firefox, Safari, and Edge. For the best experience, we recommend keeping your browser updated."
        }
      ]
    },
    {
      title: "Billing and Subscriptions",
      faqs: [
        {
          question: "What payment methods are accepted?",
          answer: "We accept bank transfers at the moment."
        },
        {
          question: "Can I cancel my subscription?",
          answer: "Yes, you can cancel your subscription at anytime through your account settings. Access will continue until the end of your current billing period."
        },
        {
          question: "Are there any refund policies?",
          answer: "Refund requests are handled on a case-by-case basis according to our Terms of Service. Contact our support team for specific inquiries."
        }
      ]
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="p-6 md:p-8">
          <h1 className="text-2xl md:text-3xl font-bold text-center text-blue-950 mb-8">
            Frequently Asked Questions
          </h1>
          
          <div className="text-gray-700 space-y-2">
            <p className="text-center mb-8">
              Find answers to common questions about using HireMe. Can't find what you're looking for?{' '}
              <a href="/contact" className="text-blue-950 font-semibold hover:underline">
                Contact our support team
              </a>
              .
            </p>

            {faqCategories.map((category, categoryIndex) => (
              <FAQCategory
                key={category.title}
                title={category.title}
                faqs={category.faqs}
                openIndex={openIndex}
                setOpenIndex={setOpenIndex}
                startIndex={categoryIndex * 10} // Allows for up to 10 questions per category
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;