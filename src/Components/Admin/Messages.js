import React, { useState, useEffect, useCallback } from 'react';
import { getDatabase, ref, get, update } from 'firebase/database';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaEnvelope, FaEnvelopeOpen } from 'react-icons/fa';

const Messages = () => {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState('all');
  const db = getDatabase(app);

  const fetchMessages = useCallback(async () => {
    try {
      const messagesRef = ref(db, 'contact_messages');
      const snapshot = await get(messagesRef);
      
      if (snapshot.exists()) {
        const messagesData = [];
        const data = snapshot.val();
        
        for (const id in data) {
          messagesData.push({
            id,
            ...data[id],
            date: new Date(data[id].timestamp)
          });
        }
        
        setMessages(messagesData.sort((a, b) => b.date - a.date));
      } else {
        setMessages([]);
      }
    } catch (error) {
      console.error('Error fetching messages:', error);
      toast.error('Error loading messages');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleMarkAsRead = async (messageId) => {
    try {
      await update(ref(db, `contact_messages/${messageId}`), {
        status: 'read'
      });
      toast.success('Message marked as read');
      fetchMessages();
    } catch (error) {
      console.error('Error updating message status:', error);
      toast.error('Error updating message status');
    }
  };

  const filterMessages = () => {
    let filtered = [...messages];

    // Date filter
    const today = new Date();
    switch (dateRange) {
      case 'today':
        filtered = filtered.filter(m => 
          m.date.toDateString() === today.toDateString()
        );
        break;
      case 'week':
        const weekAgo = new Date(today.setDate(today.getDate() - 7));
        filtered = filtered.filter(m => m.date >= weekAgo);
        break;
      case 'month':
        const monthAgo = new Date(today.setMonth(today.getMonth() - 1));
        filtered = filtered.filter(m => m.date >= monthAgo);
        break;
      default:
        break;
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(m => m.status === statusFilter);
    }

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(m =>
        m.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.message?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filtered;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-950"></div>
      </div>
    );
  }

  const filteredMessages = filterMessages();

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-bold text-blue-950 mb-6">Contact Messages</h2>

      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search messages..."
            className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="all">All Time</option>
          <option value="today">Today</option>
          <option value="week">This Week</option>
          <option value="month">This Month</option>
        </select>
        <select
          className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          <option value="unread">Unread</option>
          <option value="read">Read</option>
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Phone
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Message
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
            {filteredMessages.map((message) => (
              <tr key={message.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {message.date.toLocaleDateString()}
                  </div>
                  <div className="text-sm text-gray-500">
                    {message.date.toLocaleTimeString()}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{message.name}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{message.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900">{message.phone}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm text-gray-900 max-w-md break-words">
                    {message.message}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    message.status === 'read' 
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {message.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {message.status === 'unread' && (
                    <button
                      onClick={() => handleMarkAsRead(message.id)}
                      className="text-blue-950 hover:text-blue-800 transition-colors"
                      title="Mark as read"
                    >
                      <FaEnvelope className="h-5 w-5" />
                    </button>
                  )}
                  {message.status === 'read' && (
                    <FaEnvelopeOpen className="h-5 w-5 text-gray-400" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredMessages.length === 0 && (
        <div className="text-center py-4">
          <p className="text-gray-500">No messages found</p>
        </div>
      )}
    </div>
  );
};

export default Messages;