// Enhanced Promo Code component with payments node usage tracking
import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, set, remove, push } from 'firebase/database';
import { app } from '../../firebase';
import { toast, ToastContainer } from 'react-toastify';
import "react-toastify/dist/ReactToastify.css";

const PromoCodes = () => {
  const [promoCodes, setPromoCodes] = useState([]);
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentCode, setCurrentCode] = useState({
    code: '',
    discountPercentage: '',
    packageId: '',
    status: 'active',
    maxUses: '',
    usageCount: 0, // This will be calculated from payments node
  });

  const db = getDatabase(app);

  // FIXED: Function to calculate actual usage from payments node
  const calculatePromoUsageFromPayments = useCallback(async (promoCodeId, promoCode) => {
    try {
      const paymentsRef = ref(db, 'payments');
      const paymentsSnapshot = await get(paymentsRef);
      
      if (!paymentsSnapshot.exists()) {
        return 0;
      }
      
      let usageCount = 0;
      const allPayments = paymentsSnapshot.val();
      
      // Iterate through all employers' payments
      Object.entries(allPayments).forEach(([employerId, employerPayments]) => {
        if (!employerPayments || typeof employerPayments !== 'object') return;
        
        Object.entries(employerPayments).forEach(([paymentId, payment]) => {
          if (!payment || typeof payment !== 'object') return;
          
          // Check if this payment used the promo code
          if (payment.promoCodeApplied && payment.promoCodeDetails) {
            const paymentPromoCode = payment.promoCodeDetails.code || payment.promoCodeDetails.id;
            
            // FIXED: Include both 'completed' AND 'approved' status
            const isValidStatus = payment.status === 'completed' || payment.status === 'approved';
            
            // Match by code or ID and ensure payment is completed/approved
            if ((paymentPromoCode === promoCode || paymentPromoCode === promoCodeId) && isValidStatus) {
              usageCount++;
            }
          }
        });
      });
      
      return usageCount;
    } catch (error) {
      console.error('Error calculating promo usage from payments:', error);
      return 0;
    }
  }, [db]);

  // FIXED: Function to get detailed usage information
  const getPromoUsageDetails = useCallback(async (promoCodeId, promoCode) => {
    try {
      const paymentsRef = ref(db, 'payments');
      const paymentsSnapshot = await get(paymentsRef);
      
      if (!paymentsSnapshot.exists()) {
        return { usageCount: 0, usageDetails: [] };
      }
      
      let usageCount = 0;
      const usageDetails = [];
      const allPayments = paymentsSnapshot.val();
      
      // Iterate through all employers' payments
      Object.entries(allPayments).forEach(([employerId, employerPayments]) => {
        if (!employerPayments || typeof employerPayments !== 'object') return;
        
        Object.entries(employerPayments).forEach(([paymentId, payment]) => {
          if (!payment || typeof payment !== 'object') return;
          
          // Check if this payment used the promo code
          if (payment.promoCodeApplied && payment.promoCodeDetails) {
            const paymentPromoCode = payment.promoCodeDetails.code || payment.promoCodeDetails.id;
            
            // FIXED: Include both 'completed' AND 'approved' status
            const isValidStatus = payment.status === 'completed' || payment.status === 'approved';
            
            // Match by code or ID and ensure payment is completed/approved
            if ((paymentPromoCode === promoCode || paymentPromoCode === promoCodeId) && isValidStatus) {
              usageCount++;
              usageDetails.push({
                paymentId,
                employerId,
                employerEmail: payment.employerEmail,
                amount: payment.amount,
                originalPrice: payment.originalPrice || payment.amount,
                discount: payment.discount || 0,
                packageName: payment.packageName,
                date: payment.createdAt,
                discountPercentage: payment.promoCodeDetails.discountPercentage,
                paymentStatus: payment.status
              });
            }
          }
        });
      });
      
      return { 
        usageCount, 
        usageDetails: usageDetails.sort((a, b) => new Date(b.date) - new Date(a.date)) 
      };
    } catch (error) {
      console.error('Error getting promo usage details:', error);
      return { usageCount: 0, usageDetails: [] };
    }
  }, [db]);



  const fetchPackages = useCallback(async () => {
    try {
      const packagesSnap = await get(ref(db, 'packages'));
      if (packagesSnap.exists()) {
        const packagesData = Object.entries(packagesSnap.val())
          .map(([id, data]) => ({
            id,
            ...data
          }))
          .filter(pkg => pkg.status === 'active');
        setPackages(packagesData);
      }
    } catch (error) {
      console.error('Error fetching packages:', error);
      toast.error('Error loading packages');
    }
  }, [db]);

  const fetchPromoCodes = useCallback(async () => {
    try {
      const codesSnap = await get(ref(db, 'promoCodes'));
      if (codesSnap.exists()) {
        const codesData = await Promise.all(
          Object.entries(codesSnap.val()).map(async ([id, data]) => {
            // Calculate actual usage from payments node
            const actualUsage = await calculatePromoUsageFromPayments(id, data.code);
            
            // Automatically update the stored usage count to match actual usage
            if (actualUsage !== (data.usageCount || 0)) {
              await set(ref(db, `promoCodes/${id}/usageCount`), actualUsage);
              await set(ref(db, `promoCodes/${id}/updatedAt`), new Date().toISOString());
            }
            
            return {
              id,
              ...data,
              usageCount: actualUsage, // Use actual usage as the primary count
              createdAt: new Date(data.createdAt || Date.now())
            };
          })
        );
        setPromoCodes(codesData.sort((a, b) => b.createdAt - a.createdAt));
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching promo codes:', error);
      toast.error('Error loading promo codes');
      setLoading(false);
    }
  }, [db, calculatePromoUsageFromPayments]);

  // Function to sync stored usage count with actual payments
  const syncPromoUsage = useCallback(async (promoCodeId, promoCode) => {
    try {
      const actualUsage = await calculatePromoUsageFromPayments(promoCodeId, promoCode);
      
      // Update the stored usage count to match actual usage
      await set(ref(db, `promoCodes/${promoCodeId}/usageCount`), actualUsage);
      await set(ref(db, `promoCodes/${promoCodeId}/updatedAt`), new Date().toISOString());
      
      toast.success(`Usage count synced: ${actualUsage} uses`);
      fetchPromoCodes(); // Refresh the list
      
      return actualUsage;
    } catch (error) {
      console.error('Error syncing promo usage:', error);
      toast.error('Error syncing usage count');
      return 0;
    }
  }, [db, calculatePromoUsageFromPayments, fetchPromoCodes]);

  // Function to view usage details
  const viewUsageDetails = useCallback(async (promoCodeId, promoCode) => {
    try {
      const { usageCount, usageDetails } = await getPromoUsageDetails(promoCodeId, promoCode);
      
      // Create a modal or alert with usage details
      let detailsMessage = `Promo Code: ${promoCode}\nTotal Uses: ${usageCount}\n\nUsage Details:\n`;
      
      if (usageDetails.length === 0) {
        detailsMessage += 'No usage found in payments.';
      } else {
        usageDetails.forEach((detail, index) => {
          detailsMessage += `\n${index + 1}. ${new Date(detail.date).toLocaleDateString()} - ${detail.employerEmail}`;
          detailsMessage += `\n   Package: ${detail.packageName}`;
          detailsMessage += `\n   Amount: $${detail.amount.toFixed(2)} (was $${detail.originalPrice.toFixed(2)})`;
          detailsMessage += `\n   Discount: ${detail.discountPercentage}% (-$${detail.discount.toFixed(2)})`;
          detailsMessage += `\n   Payment Status: ${detail.paymentStatus}`;
          detailsMessage += `\n   Payment ID: ${detail.paymentId}\n`;
        });
      }
      
      alert(detailsMessage); // You can replace this with a proper modal
      
    } catch (error) {
      console.error('Error viewing usage details:', error);
      toast.error('Error loading usage details');
    }
  }, [getPromoUsageDetails]);

  useEffect(() => {
    fetchPromoCodes();
    fetchPackages();
  }, [fetchPromoCodes, fetchPackages]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentCode(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const resetForm = () => {
    setCurrentCode({
      code: '',
      discountPercentage: '',
      packageId: '',
      status: 'active',
      maxUses: '',
      usageCount: 0
    });
    setIsEditing(false);
  };

  const validateForm = () => {
    if (!currentCode.code || !currentCode.discountPercentage || !currentCode.packageId) {
      toast.error('Please fill in all required fields');
      return false;
    }

    if (currentCode.discountPercentage < 1 || currentCode.discountPercentage > 100) {
      toast.error('Discount percentage must be between 1 and 100');
      return false;
    }

    if (currentCode.maxUses && (isNaN(currentCode.maxUses) || currentCode.maxUses < 1)) {
      toast.error('Maximum uses must be a positive number');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const promoData = {
        ...currentCode,
        discountPercentage: parseFloat(currentCode.discountPercentage),
        maxUses: currentCode.maxUses ? parseInt(currentCode.maxUses) : null,
        usageCount: currentCode.usageCount || 0,
        createdAt: currentCode.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      if (isEditing && currentCode.id) {
        await set(ref(db, `promoCodes/${currentCode.id}`), promoData);
        toast.success('Promo code updated successfully');
      } else {
        const existingCodesSnap = await get(ref(db, 'promoCodes'));
        const exists = existingCodesSnap.exists() && 
          Object.values(existingCodesSnap.val()).some(
            code => code.code.toLowerCase() === currentCode.code.toLowerCase()
          );
        
        if (exists) {
          toast.error('This promo code already exists');
          return;
        }

        await push(ref(db, 'promoCodes'), promoData);
        toast.success('Promo code created successfully');
      }

      resetForm();
      fetchPromoCodes();
    } catch (error) {
      console.error('Error saving promo code:', error);
      toast.error('Error saving promo code');
    }
  };

  const handleEdit = (code) => {
    setCurrentCode({
      ...code,
      maxUses: code.maxUses || ''
    });
    setIsEditing(true);
  };

  const handleDelete = async (codeId) => {
    if (window.confirm('Are you sure you want to delete this promo code?')) {
      try {
        await remove(ref(db, `promoCodes/${codeId}`));
        toast.success('Promo code deleted successfully');
        fetchPromoCodes();
      } catch (error) {
        console.error('Error deleting promo code:', error);
        toast.error('Error deleting promo code');
      }
    }
  };

  const getFilteredCodes = () => {
    return promoCodes.filter(code => {
      if (filterStatus === 'active') {
        return code.status === 'active';
      }
      if (filterStatus === 'inactive') {
        return code.status === 'inactive';
      }
      return true;
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  const filteredCodes = getFilteredCodes();
  
  const getPackageInfo = (packageId) => {
    const packageInfo = packages.find(pkg => pkg.id === packageId);
    return packageInfo ? packageInfo : { name: 'Unknown Package', duration: 'N/A' };
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <ToastContainer 
        position="top-right" 
        autoClose={4000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        limit={1}
      />
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-950">Promo Codes</h2>
        <button
          onClick={() => setIsEditing(false)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Create New Promo Code
        </button>
      </div>

      {/* Promo Code Form */}
      <form onSubmit={handleSubmit} className="mb-8 bg-gray-50 p-6 rounded-lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Promo Code*
            </label>
            <input
              type="text"
              name="code"
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentCode.code}
              onChange={handleInputChange}
              placeholder="e.g., HMJ1001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Discount (%)*
            </label>
            <input
              type="number"
              name="discountPercentage"
              required
              min="1"
              max="100"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentCode.discountPercentage}
              onChange={handleInputChange}
              placeholder="Enter percentage (1-100)"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Select Package*
            </label>
            <select
              name="packageId"
              required
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentCode.packageId}
              onChange={handleInputChange}
            >
              <option value="">Select a package</option>
              {packages.map(pkg => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.name} (${pkg.price}) - {pkg.duration || 'No duration'} days
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Maximum Uses (Optional)
            </label>
            <input
              type="number"
              name="maxUses"
              min="1"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentCode.maxUses}
              onChange={handleInputChange}
              placeholder="Leave blank for unlimited uses"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              name="status"
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={currentCode.status}
              onChange={handleInputChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>
        <div className="mt-4 flex gap-4">
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {isEditing ? 'Update Promo Code' : 'Create Promo Code'}
          </button>
          <button
            type="button"
            onClick={resetForm}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Cancel
          </button>
        </div>
      </form>

      {/* Filter */}
      <div className="mb-6">
        <select
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        >
          <option value="all">All Promo Codes</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {/* Promo Codes Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Discount
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Package
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Usage
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredCodes.map((code) => {
              const packageInfo = getPackageInfo(code.packageId);
              
              return (
                <tr key={code.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{code.code}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{code.discountPercentage}%</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {packageInfo.name} ({packageInfo.duration || 'N/A'} days)
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {code.usageCount || 0}{code.maxUses ? `/${code.maxUses}` : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(code.createdAt).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      code.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {code.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex flex-col space-y-1">
                      <div>
                        <button
                          onClick={() => handleEdit(code)}
                          className="text-blue-600 hover:text-blue-900 mr-2"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(code.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </div>
                      <div>
                        <button
                          onClick={() => viewUsageDetails(code.id, code.code)}
                          className="text-green-600 hover:text-green-900 text-xs mr-2"
                        >
                          View Details
                        </button>
                        <button
                          onClick={() => syncPromoUsage(code.id, code.code)}
                          className="text-purple-600 hover:text-purple-900 text-xs"
                        >
                          Sync Usage
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {filteredCodes.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-500">No promo codes found</p>
        </div>
      )}
    </div>
  );
};

export default PromoCodes;