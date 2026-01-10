import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { Invoice } from '../Invoice';
import { FaFileInvoice, FaSearch, FaSortAmountDown, FaSortAmountUp, FaCheck, FaClock, FaTimes, FaHourglass } from 'react-icons/fa';

const PaymentHistory = () => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [statusFilter, setStatusFilter] = useState('all');

  const auth = getAuth(app);
  const db = getDatabase(app);

  useEffect(() => {
    const fetchPayments = async () => {
      try {
        if (!auth.currentUser) {
          setLoading(false);
          return;
        }

        const userId = auth.currentUser.uid;
        
        // Get all related data
        const [paymentSnap, employerSnap, packagesSnap, checkoutSnap] = await Promise.all([
          get(ref(db, `payments/${userId}`)),
          get(ref(db, `employers/${userId}`)),
          get(ref(db, 'packages')),
          get(ref(db, 'checkoutSessions'))
        ]);

        const employer = employerSnap.val() || {};
        const profile = employer.profile || {};
        const packages = packagesSnap.val() || {};
        const paymentsList = [];

        // Set to track unique payment IDs to prevent duplicates
        const processedIds = new Set();

        // Handle regular payments
        if (paymentSnap.exists()) {
          const paymentsData = paymentSnap.val();
          
          for (const paymentId in paymentsData) {
            // Skip if we've already processed this ID
            if (processedIds.has(paymentId)) continue;
            
            const paymentData = paymentsData[paymentId];
            const packageInfo = packages[paymentData.packageId] || {};
            
            paymentsList.push({
              id: paymentId,
              orderId: paymentData.orderId || paymentId,
              date: new Date(paymentData.createdAt),
              packageName: packageInfo.name || paymentData.packageName || 'Unknown Package',
              amount: paymentData.amount,
              paymentMethod: paymentData.paymentMethod,
              status: paymentData.status,
              employerName: `${employer.firstName || ''} ${employer.lastName || ''}`.trim(),
              employerEmail: profile.email || employer.email,
              profile: {
                firstName: employer.firstName,
                lastName: employer.lastName,
                companyName: profile.companyName,
                phone: profile.phone,
                email: profile.email || employer.email
              },
              sourceType: 'payment',
              declineReason: paymentData.declineReason || null,
              approvedAt: paymentData.approvedAt,
              declinedAt: paymentData.declinedAt,
              isFreeSubscription: paymentData.isFreeSubscription || false,
              packageDetails: paymentData.packageDetails || packageInfo
            });
            
            // Mark as processed
            processedIds.add(paymentId);
          }
        }

        // Handle checkout sessions for this user only
        if (checkoutSnap.exists()) {
          const checkoutSessions = checkoutSnap.val();
          for (const sessionId in checkoutSessions) {
            // Skip if we've already processed this ID
            if (processedIds.has(sessionId)) continue;
            
            const session = checkoutSessions[sessionId];
            
            // Only include sessions for this user
            if (session.userId === userId) {
              const matchingPackage = Object.values(packages).find(
                p => Math.abs((p.price || 0) - (session.finalPrice || session.amount / 100 || 0)) <= 0.50
              );

              paymentsList.push({
                id: sessionId,
                orderId: session.orderId || sessionId,
                date: new Date(session.createdAt),
                packageName: session.packageName || matchingPackage?.name || 'Package',
                amount: session.finalPrice || session.amount / 100, // Use finalPrice first, then convert from cents
                paymentMethod: session.amount === 0 ? 'promo_code_100_percent' : 'card',
                status: session.status || 'pending',
                employerName: `${employer.firstName || ''} ${employer.lastName || ''}`.trim(),
                employerEmail: profile.email || employer.email,
                profile: {
                  firstName: employer.firstName,
                  lastName: employer.lastName,
                  companyName: profile.companyName,
                  phone: profile.phone,
                  email: profile.email || employer.email
                },
                sourceType: 'checkout',
                isFreeSubscription: (session.finalPrice || session.amount) === 0,
                packageDetails: session.package || matchingPackage
              });
              
              // Mark as processed
              processedIds.add(sessionId);
            }
          }
        }

        // Sort payments by date, most recent first
        setPayments(paymentsList.sort((a, b) => b.date - a.date));
        setLoading(false);
      } catch (error) {
        console.error('Error fetching payment history:', error);
        toast.error('Error loading payment history');
        setLoading(false);
      }
    };

    fetchPayments();
  }, [auth.currentUser, db]);

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
    
    // Handle the "completed" status which should show as "pending" in the UI for checkout sessions
    if (statusFilter === 'pending') {
      return paymentsToFilter.filter(payment => 
        payment.status === 'pending' || payment.status === 'completed'
      );
    }
    
    return paymentsToFilter.filter(payment => payment.status === statusFilter);
  };

  const filteredPayments = getFilteredByStatus(payments).filter(payment => {
    const searchString = searchTerm.toLowerCase();
    return (
      payment.packageName?.toLowerCase().includes(searchString) ||
      payment.date.toLocaleDateString().includes(searchString) ||
      payment.amount?.toString().includes(searchString) ||
      payment.paymentMethod?.toLowerCase().includes(searchString) ||
      payment.orderId?.toLowerCase().includes(searchString) ||
      payment.status?.toLowerCase().includes(searchString) ||
      generateInvoiceNumber(payment).toLowerCase().includes(searchString)
    );
  });

  const sortedAndFilteredPayments = getSortedPayments(filteredPayments);

  // Generate invoice number (same format as Transactions.js)
  const generateInvoiceNumber = (payment) => {
    const date = payment.date;
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

  // Get status badge (same format as Transactions.js)
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

  // Get source badge
  const getSourceBadge = (sourceType) => {
    const color = sourceType === 'payment' 
      ? 'bg-blue-100 text-blue-700' 
      : 'bg-purple-100 text-purple-800';
    
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
        {sourceType === 'payment' ? 'Payment' : 'Checkout'}
      </span>
    );
  };

  // Get payment counts by status (same format as Transactions.js)
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
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-blue-950 mb-4">Payment History</h2>
        
        {/* Payment status summary */}
        {payments.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-blue-900">{counts.total}</div>
              <div className="text-sm text-blue-700">Total Payments</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-2xl font-bold text-yellow-900">{counts.pending}</div>
              <div className="text-sm text-yellow-700">Pending</div>
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
        
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
          <div className="relative w-full lg:w-96">
            <input
              type="text"
              placeholder="Search payments..."
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
      </div>

      {sortedAndFilteredPayments.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice #</th>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Package</th>
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Method</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Invoice</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedAndFilteredPayments.map((payment, index) => (
                <tr key={`${payment.id}-${payment.sourceType}-${index}`} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {payment.orderId}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                    {generateInvoiceNumber(payment)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.date.toLocaleDateString()}
                    <div className="text-xs text-gray-500">
                      {payment.date.toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.packageName}
                    {payment.isFreeSubscription && (
                      <div className="text-xs text-green-600">Free (Promo)</div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    ${parseFloat(payment.amount || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {payment.paymentMethod === 'card' ? 'Credit Card' : 
                     payment.paymentMethod === 'bank_transfer' ? 'Bank Transfer' :
                     payment.paymentMethod === 'mobile_money' ? 'Mobile Money' :
                     payment.paymentMethod === 'promo_code_100_percent' ? 'Promo Code' :
                     'Other'}
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
                    {getSourceBadge(payment.sourceType)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {(payment.status === 'approved' || payment.status === 'declined') ? (
                      <Invoice data={{
                        ...payment,
                        invoiceNumber: generateInvoiceNumber(payment)
                      }} />
                    ) : (
                      <span className="text-gray-400 text-xs">
                        {payment.status === 'pending' || payment.status === 'completed' ? 'Pending approval' : 'Not available'}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8">
          <div className="max-w-sm mx-auto">
            <FaFileInvoice className="mx-auto h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Payment History
            </h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? "No payments match your search criteria"
                : "You haven't made any payments yet"}
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
      )}
    </div>
  );
};

export default PaymentHistory;