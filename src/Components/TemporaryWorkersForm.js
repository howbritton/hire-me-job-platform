import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { TextField, Button, Checkbox, FormControlLabel } from '@mui/material';
import { getDatabase, ref, push } from 'firebase/database';
import { app } from '../firebase';
import { toast } from 'react-toastify';

const TemporaryWorkersForm = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    phone: '',
    email: '',
    canDoStrenuousWork: false,
    whatsappContact: false
  });

  const db = getDatabase(app);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      const tempWorkersRef = ref(db, 'temporaryWorkers');
      await push(tempWorkersRef, {
        ...formData,
        status: 'active',
        listedDate: new Date().toISOString(),
        createdAt: new Date().toISOString()
      });
      
      toast.success('Application submitted successfully!');
      // Redirect to the list page after successful submission
      navigate('/temporary-workers');
    } catch (error) {
      console.error('Error submitting application:', error);
      toast.error('Error submitting application. Please try again.');
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleViewListings = () => {
    navigate('/temporary-workers');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-[#263571]">
          Temporary Work - No Skills Required!
        </h1>
        <Button
          variant="outlined"
          onClick={handleViewListings}
          className="text-blue-600 border-blue-600 hover:bg-blue-50"
        >
          View All Listings
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 bg-white p-6 rounded-lg shadow">
        {/* ... rest of the form fields remain the same ... */}
        <TextField
          fullWidth
          label="Full Name"
          name="name"
          required
          value={formData.name}
          onChange={handleInputChange}
          variant="outlined"
        />

        <TextField
          fullWidth
          label="Location"
          name="location"
          required
          value={formData.location}
          onChange={handleInputChange}
          variant="outlined"
        />

        <TextField
          fullWidth
          label="Phone Number"
          name="phone"
          required
          value={formData.phone}
          onChange={handleInputChange}
          variant="outlined"
        />

        <TextField
          fullWidth
          label="Email"
          name="email"
          type="email"
          required
          value={formData.email}
          onChange={handleInputChange}
          variant="outlined"
        />

        <div className="space-y-2">
          <FormControlLabel
            control={
              <Checkbox
                name="canDoStrenuousWork"
                checked={formData.canDoStrenuousWork}
                onChange={handleInputChange}
              />
            }
            label="Able to do strenuous work"
          />

          <FormControlLabel
            control={
              <Checkbox
                name="whatsappContact"
                checked={formData.whatsappContact}
                onChange={handleInputChange}
              />
            }
            label="Can we contact you via WhatsApp?"
          />
        </div>

        <Button
          type="submit"
          variant="contained"
          fullWidth
          className="bg-blue-600 hover:bg-blue-700"
        >
          Submit Application
        </Button>
      </form>

      <div className="mt-6 text-center text-gray-600">
        <p>
          Please contact us at{' '}
          <a href="mailto:info@hiremeja.com" className="text-blue-600 hover:underline">
            info@hiremeja.com
          </a>{' '}
          to be removed from the listing.
        </p>
      </div>
    </div>
  );
};

export default TemporaryWorkersForm;