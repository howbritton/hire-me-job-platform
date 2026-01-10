import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, set, update } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../firebase';
import { FaDownload, FaFileInvoice, FaCheck, FaClock, FaTimes, FaHourglass, FaSearch, FaSortAmountDown, FaSortAmountUp } from 'react-icons/fa';
import { Invoice } from '../Invoice';

const Transactions = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState('all');
  const db = getDatabase(app);
  const functions = getFunctions();

  // Function to migrate checkout session to payments node
  const migrateCheckoutSessionToPayments = async (sessionId, paymentObj) => {
    try {
      const userId = paymentObj.employerId || paymentObj.userId;
      const amount = paymentObj.amount || 0;
      
      if (!userId) {
        throw new Error('Missing userId in checkout session');
      }

      let userEmail = paymentObj.employerEmail;
      if (!userEmail) {
        try {
          const employerSnapshot = await get(ref(db, `employers/${userId}`));
          if (employerSnapshot.exists()) {
            const employerData = employerSnapshot.val();
            userEmail = employerData.email || employerData.profile?.email;
          }
        } catch (error) {
          console.error('Error fetching employer email:', error);
        }
      }

      if (!userEmail) {
        userEmail = `user-${userId}@hiremeja.com`;
      }

      let packageId = paymentObj.packageId || 'unknown';
      let packageName = paymentObj.packageName || 'Package';
      let packageDetails = paymentObj.packageDetails;

      if (!packageDetails && (!paymentObj.packageId || !paymentObj.packageName)) {
        try {
          const packagesSnapshot = await get(ref(db, 'packages'));
          if (packagesSnapshot.exists()) {
            const packagesData = packagesSnapshot.val();
            
            const matchingPackage = Object.entries(packagesData).find(([id, pkg]) => {
              return Math.abs(parseFloat(pkg.price || 0) - amount) <= 0.50;
            });
            
            if (matchingPackage) {
              const [id, pkg] = matchingPackage;
              packageId = id;
              packageName = pkg.name;
              packageDetails = pkg;
              console.log(`Found matching package: ${packageName} for amount ${amount}`);
            }
          }
        } catch (error) {
          console.error('Error fetching packages:', error);
        }
      }

      if (!packageDetails) {
        packageDetails = {
          name: packageName,
          duration: 30,
          jobPostLimit: 10,
          price: amount
        };
      }

      const paymentData = {
        packageId: packageId,
        packageName: packageName,
        amount: amount,
        status: 'pending',
        createdAt: paymentObj.createdAt || new Date().toISOString(),
        employerId: userId,
        employerEmail: userEmail,
        paymentMethod: amount === 0 ? 'promo_code_100_percent' : 'card',
        orderId: sessionId,
        currency: 'USD',
        packageDetails: packageDetails,
        isFreeSubscription: amount === 0,
        migratedFromCheckout: true,
        migratedAt: new Date().toISOString()
      };

      const cleanPaymentData = Object.fromEntries(
        Object.entries(paymentData).filter(([_, value]) => value !== undefined)
      );

      await set(ref(db, `payments/${userId}/${sessionId}`), cleanPaymentData);
      console.log(`Successfully migrated checkout session ${sessionId} to payments`);
      return true;
    } catch (error) {
      console.error(`Error migrating checkout session ${sessionId}:`, error);
      throw error;
    }
  };

  // Generate invoice number (same format as PaymentHistory.js)
  const generateInvoiceNumber = (payment) => {
    const date = new Date(payment.createdAt || payment.date);
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    
    let uniqueId = '';
    if (payment.id) {
      if (payment.id.startsWith('ORDER-') || payment.id.startsWith('FREE-')) {
        uniqueId = payment.id.substring(payment.id.indexOf('-') + 1, payment.id.indexOf('-') + 7);
      } else if (!isNaN(parseInt(payment.id))) {
        uniqueId = payment.id.toString().slice(-6);
      } else {
        uniqueId = payment.id.replace(/[^a-zA-Z0-9]/g, '').substring(0, 6);
      }
    }
    
    return `INV-${year}${month}-${uniqueId}`;
  };

  const approvePayment = async (payment) => {
    const paymentKey = `${payment.employerId}_${payment.id}`;
    setProcessing(prev => ({ ...prev, [paymentKey]: 'approving' }));

    try {
      if (payment.source === 'checkoutSessions') {
        await migrateCheckoutSessionToPayments(payment.id, payment);
      }

      await update(ref(db, `payments/${payment.employerId}/${payment.id}`), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      const now = new Date();
      const endDate = new Date(now);
      
      // ✅ FIX: Better duration handling with multiple fallbacks
      let duration = 30; // Default fallback
      
      if (payment.packageDetails?.duration) {
        duration = payment.packageDetails.duration;
      } else if (payment.package?.duration) {
        duration = payment.package.duration;
      } else {
        // Try to get duration from the packages collection
        try {
          const packageRef = ref(db, `packages/${payment.packageId}`);
          const packageSnapshot = await get(packageRef);
          if (packageSnapshot.exists()) {
            const packageData = packageSnapshot.val();
            duration = packageData.duration || 30;
          }
        } catch (error) {
          console.error('Error fetching package duration:', error);
          // Keep default of 30
        }
      }
      
      console.log(`Using duration: ${duration} days for package: ${payment.packageName}`);
      endDate.setDate(endDate.getDate() + duration);
      
      await update(ref(db, `employers/${payment.employerId}/subscription`), {
        status: 'active',
        paymentStatus: 'confirmed',
        startDate: now.toISOString(),
        endDate: endDate.toISOString(),
        package: payment.packageDetails || payment.package,
        packageId: payment.packageId,
        packageName: payment.packageName,
        duration: duration, // ✅ Store the actual duration used
        updatedAt: now.toISOString(),
        approvedAt: now.toISOString()
      });

      // Send approval email
      try {
        const sendApprovalEmail = httpsCallable(functions, 'sendPaymentApprovalEmail');
        await sendApprovalEmail({
          employerId: payment.employerId,
          employerEmail: payment.employerEmail,
          paymentId: payment.id,
          packageName: payment.packageName,
          amount: payment.amount,
          status: 'approved'
        });
      } catch (emailError) {
        console.error('Approval email failed:', emailError);
      }

      // Send invoice email
      try {
        const invoiceNumber = generateInvoiceNumber(payment);
        const sendInvoiceEmail = httpsCallable(functions, 'notifyInvoiceEmail');
        await sendInvoiceEmail({
          employerId: payment.employerId,
          employerEmail: payment.employerEmail,
          paymentId: payment.id,
          invoiceNumber: invoiceNumber,
          packageName: payment.packageName,
          amount: payment.amount,
          packageDetails: payment.packageDetails || payment.package,
          paymentDate: new Date().toISOString(),
          status: 'approved'
        });
      } catch (emailError) {
        console.error('Invoice email failed:', emailError);
      }

      alert('Payment approved successfully! Approval and invoice emails have been sent.');
      await fetchPayments();
    } catch (error) {
      console.error('Error approving payment:', error);
      alert('Failed to approve payment. Please try again.');
    } finally {
      setProcessing(prev => ({ ...prev, [paymentKey]: null }));
    }
  };

  const declinePayment = async (payment) => {
    const reason = prompt('Enter decline reason:');
    if (!reason) return;

    const paymentKey = `${payment.employerId}_${payment.id}`;
    setProcessing(prev => ({ ...prev, [paymentKey]: 'declining' }));

    try {
      if (payment.source === 'checkoutSessions') {
        await migrateCheckoutSessionToPayments(payment.id, payment);
      }

      await update(ref(db, `payments/${payment.employerId}/${payment.id}`), {
        status: 'declined',
        declinedAt: new Date().toISOString(),
        declineReason: reason,
        updatedAt: new Date().toISOString()
      });

      await update(ref(db, `employers/${payment.employerId}/subscription`), {
        status: 'inactive',
        paymentStatus: 'declined',
        updatedAt: new Date().toISOString()
      });

      try {
        const sendDeclineEmail = httpsCallable(functions, 'sendPaymentDeclineEmail');
        await sendDeclineEmail({
          employerId: payment.employerId,
          employerEmail: payment.employerEmail,
          paymentId: payment.id,
          packageName: payment.packageName,
          amount: payment.amount,
          declineReason: reason,
          status: 'declined'
        });
      } catch (emailError) {
        console.error('Decline email failed:', emailError);
      }

      alert('Payment declined successfully.');
      await fetchPayments();
    } catch (error) {
      console.error('Error declining payment:', error);
      alert('Failed to decline payment. Please try again.');
    } finally {
      setProcessing(prev => ({ ...prev, [paymentKey]: null }));
    }
  };

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      
      const [paymentsSnapshot, checkoutSessionsSnapshot, employersSnapshot] = await Promise.all([
        get(ref(db, 'payments')),
        get(ref(db, 'checkoutSessions')),
        get(ref(db, 'employers'))
      ]);
      
      const paymentsData = paymentsSnapshot.exists() ? paymentsSnapshot.val() : {};
      const checkoutSessionsData = checkoutSessionsSnapshot.exists() ? checkoutSessionsSnapshot.val() : {};
      const employersData = employersSnapshot.exists() ? employersSnapshot.val() : {};
      
      let paymentsArray = [];
      
      // Process existing payments
      for (const employerId in paymentsData) {
        const employerPayments = paymentsData[employerId];
        const employer = employersData[employerId] || {};
        
        for (const paymentId in employerPayments) {
          const paymentData = employerPayments[paymentId];
          
          if (!paymentData) continue;
          
          const paymentObj = {
            id: paymentId,
            employerId,
            ...paymentData,
            employerName: employer.firstName && employer.lastName 
              ? `${employer.firstName} ${employer.lastName}`
              : employer.email || paymentData.employerEmail,
            employerEmail: paymentData.employerEmail || employer.email,
            date: new Date(paymentData.createdAt || Date.now()),
            source: 'payments',
            profile: {
              firstName: employer.firstName,
              lastName: employer.lastName,
              companyName: employer.profile?.companyName,
              phone: employer.profile?.phone,
              email: employer.profile?.email || employer.email
            }
          };
          
          paymentsArray.push(paymentObj);
        }
      }

      // Process checkout sessions that need approval
      for (const sessionId in checkoutSessionsData) {
        const session = checkoutSessionsData[sessionId];
        
        // Skip if this session is already in payments
        const exists = paymentsArray.some(p => p.id === sessionId || p.orderId === sessionId);
        if (exists) continue;
        
        // Show both completed and pending sessions for admin review
        if (session.status === 'completed' || session.status === 'pending') {
          const userId = session.userId;
          
          if (!userId) {
            console.log(`Skipping checkout session ${sessionId}: No user ID found`);
            continue;
          }
          
          const employer = employersData[userId] || {};
          const amount = session.amount || 0;
          
          const sessionObj = {
            id: sessionId,
            orderId: sessionId,
            employerId: userId,
            employerName: employer.firstName && employer.lastName 
              ? `${employer.firstName} ${employer.lastName}`
              : employer.email || 'Unknown User',
            employerEmail: employer.email || 'No email',
            packageName: session.packageName || 'Package',
            packageId: session.packageId || 'unknown',
            packageDetails: session.packageDetails || {
              name: session.packageName || 'Package',
              duration: 30,
              jobPostLimit: 10,
              price: amount
            },
            amount: amount,
            status: session.status === 'pending' ? 'pending' : 'completed',
            createdAt: session.createdAt || session.lastUpdated,
            date: new Date(session.createdAt || session.lastUpdated || Date.now()),
            source: 'checkoutSessions',
            paymentMethod: amount === 0 ? 'promo_code_100_percent' : 'card',
            isFreeSubscription: amount === 0,
            profile: {
              firstName: employer.firstName,
              lastName: employer.lastName,
              companyName: employer.profile?.companyName,
              phone: employer.profile?.phone,
              email: employer.profile?.email || employer.email
            }
          };
          
          paymentsArray.push(sessionObj);
        }
      }
      
      setPayments(paymentsArray.sort((a, b) => b.date - a.date));
      setLoading(false);
    } catch (error) {
      console.error("Error fetching payments:", error);
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Sorting functionality
  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const getSortedPayments = (paymentsToSort) => {
    if (sortConfig.key === null) return paymentsToSort;
    
    return [...paymentsToSort].sort((a, b) => {
      if (sortConfig.key === 'date') {
        return sortConfig.direction === 'asc' 
          ? a.date - b.date 
          : b.date - a.date;
      }
      
      if (sortConfig.key === 'amount') {
        return sortConfig.direction === 'asc' 
          ? parseFloat(a.amount) - parseFloat(b.amount) 
          : parseFloat(b.amount) - parseFloat(a.amount);
      }
      
      return 0;
    });
  };

  // Filter by status
  const getFilteredByStatus = (paymentsToFilter) => {
    if (statusFilter === 'all') return paymentsToFilter;
    
    // Handle the "completed" status which should show as "pending" in the UI
    if (statusFilter === 'pending') {
      return paymentsToFilter.filter(payment => 
        payment.status === 'pending' || payment.status === 'completed'
      );
    }
    
    return paymentsToFilter.filter(payment => payment.status === statusFilter);
  };

  // Filter and sort payments
  const filteredPayments = getFilteredByStatus(payments).filter(payment => {
    const searchString = searchTerm.toLowerCase();
    return (
      payment.packageName?.toLowerCase().includes(searchString) ||
      payment.date.toLocaleDateString().includes(searchString) ||
      payment.amount?.toString().includes(searchString) ||
      payment.paymentMethod?.toLowerCase().includes(searchString) ||
      payment.orderId?.toLowerCase().includes(searchString) ||
      payment.id?.toLowerCase().includes(searchString) ||
      payment.employerName?.toLowerCase().includes(searchString) ||
      payment.employerEmail?.toLowerCase().includes(searchString) ||
      payment.status?.toLowerCase().includes(searchString) ||
      generateInvoiceNumber(payment).toLowerCase().includes(searchString)
    );
  });

  const sortedAndFilteredPayments = getSortedPayments(filteredPayments);

  // Get status badge (same format as PaymentHistory.js)
  const getStatusBadge = (status) => {
    const statusConfig = {
      'pending': { 
        color: 'bg-yellow-100 text-yellow-800', 
        icon: <FaHourglass className="w-3 h-3" />,
        text: 'Pending Approval'
      },
      'approved': { 
        color: 'bg-green-100 text-green-800', 
        icon: <FaCheck className="w-3 h-3" />,
        text: 'Approved'
      },
      'completed': { 
        color: 'bg-blue-100 text-blue-800', 
        icon: <FaClock className="w-3 h-3" />,
        text: 'Needs Approval'
      },
      'declined': { 
        color: 'bg-red-100 text-red-800', 
        icon: <FaTimes className="w-3 h-3" />,
        text: 'Declined'
      }
    };

    const config = statusConfig[status] || { 
      color: 'bg-gray-100 text-gray-800', 
      icon: <FaClock className="w-3 h-3" />,
      text: status 
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.icon}
        <span className="ml-1">{config.text}</span>
      </span>
    );
  };

  const getSourceBadge = (source) => {
    const color = source === 'payments' 
      ? 'bg-blue-100 text-blue-700' 
      : 'bg-purple-100 text-purple-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {source === 'payments' ? 'Payment' : 'Checkout'}
      </span>
    );
  };

  // Get payment counts by status (same format as PaymentHistory.js)
  const getPaymentCounts = () => {
    return {
      total: payments.length,
      pending: payments.filter(p => p.status === 'pending' || p.status === 'completed').length,
      approved: payments.filter(p => p.status === 'approved').length,
      declined: payments.filter(p => p.status === 'declined').length
    };
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  const counts = getPaymentCounts();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-blue-950">Transactions</h2>
      </div>

      {/* Search and Filter Section */}
      <div className="mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="relative w-full lg:w-96">
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
            <FaSearch className="absolute left-3 top-3 text-gray-400" />
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Status:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="declined">Declined</option>
              </select>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Sort by:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => requestSort('date')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-colors ${
                    sortConfig.key === 'date' 
                      ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                      : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Date
                  {sortConfig.key === 'date' && (
                    sortConfig.direction === 'asc' 
                      ? <FaSortAmountUp className="ml-1" /> 
                      : <FaSortAmountDown className="ml-1" />
                  )}
                </button>
                <button
                  onClick={() => requestSort('amount')}
                  className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center transition-colors ${
                    sortConfig.key === 'amount' 
                      ? 'bg-blue-100 text-blue-800 border border-blue-300' 
                      : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  Amount
                  {sortConfig.key === 'amount' && (
                    sortConfig.direction === 'asc' 
                      ? <FaSortAmountUp className="ml-1" /> 
                      : <FaSortAmountDown className="ml-1" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Payment status summary cards */}
        {payments.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{counts.total}</div>
              <div className="text-sm text-blue-700">Total Transactions</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-yellow-900">{counts.pending}</div>
              <div className="text-sm text-yellow-700">Pending Approval</div>
            </div>
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-green-900">{counts.approved}</div>
              <div className="text-sm text-green-700">Approved</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-red-900">{counts.declined}</div>
              <div className="text-sm text-red-700">Declined</div>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Order ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice #
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('date')}
              >
                <div className="flex items-center">
                  Date
                  {sortConfig.key === 'date' && (
                    sortConfig.direction === 'asc' 
                      ? <FaSortAmountUp className="ml-1" /> 
                      : <FaSortAmountDown className="ml-1" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Employer
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
                onClick={() => requestSort('amount')}
              >
                <div className="flex items-center">
                  Amount
                  {sortConfig.key === 'amount' && (
                    sortConfig.direction === 'asc' 
                      ? <FaSortAmountUp className="ml-1" /> 
                      : <FaSortAmountDown className="ml-1" />
                  )}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Invoice
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedAndFilteredPayments.map((payment, index) => {
              const paymentKey = `${payment.employerId}_${payment.id}`;
              const isProcessing = processing[paymentKey];
              const isPendingApproval = payment.status === 'pending' || payment.status === 'completed';
              const canDownloadInvoice = payment.status === 'approved' || payment.status === 'declined';
              
              return (
                <tr key={`${payment.id}-${payment.source}-${index}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">
                      {payment.orderId || payment.id}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-mono text-gray-900">
                      {generateInvoiceNumber(payment)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {payment.date.toLocaleDateString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {payment.date.toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{payment.employerName}</div>
                    <div className="text-sm text-gray-500">{payment.employerEmail}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      ${parseFloat(payment.amount || 0).toFixed(2)}
                    </div>
                    {payment.isFreeSubscription && (
                      <div className="text-xs text-green-600">Free (Promo)</div>
                    )}
                    <div className="text-xs text-gray-500">
                      {payment.packageName || 'Package'}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(payment.status)}
                    {payment.declineReason && (
                      <div className="text-xs text-red-600 mt-1" title={payment.declineReason}>
                        Reason: {payment.declineReason.length > 20 ? 
                          payment.declineReason.substring(0, 20) + '...' : 
                          payment.declineReason}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getSourceBadge(payment.source)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {canDownloadInvoice ? (
                      <Invoice data={{
                        ...payment,
                        invoiceNumber: generateInvoiceNumber(payment)
                      }} />
                    ) : (
                      <span className="text-gray-400 text-xs">
                        {isPendingApproval ? 'Pending approval' : 'Not available'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex space-x-2">
                      {isPendingApproval && (
                        <>
                          <button
                            onClick={() => approvePayment(payment)}
                            disabled={isProcessing}
                            className={`text-xs px-3 py-1 rounded font-medium ${
                              isProcessing === 'approving'
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                            }`}
                          >
                            {isProcessing === 'approving' ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => declinePayment(payment)}
                            disabled={isProcessing}
                            className={`text-xs px-3 py-1 rounded font-medium ${
                              isProcessing === 'declining'
                                ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }`}
                          >
                            {isProcessing === 'declining' ? 'Declining...' : 'Decline'}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedAndFilteredPayments.length === 0 ? (
        <div className="text-center py-8">
          <div className="max-w-sm mx-auto">
            <FaFileInvoice className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Transactions Found
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? "No transactions match your search criteria"
                : "No payment transactions have been submitted yet"}
            </p>
            {(searchTerm || statusFilter !== 'all') && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setStatusFilter('all');
                }}
                className="text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default Transactions;