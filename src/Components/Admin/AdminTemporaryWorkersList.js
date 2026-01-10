import React, { useState, useEffect } from 'react';
import { getDatabase, ref, get, set, remove, push } from 'firebase/database';
import { getAuth } from 'firebase/auth';
import { app } from '../../firebase';
import { toast } from 'react-toastify';
import { FaEdit, FaTrash, FaPlus, FaFileExcel } from 'react-icons/fa';
import * as XLSX from 'xlsx';

const AdminTemporaryWorkersList = () => {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingWorker, setEditingWorker] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const db = getDatabase(app);
  const auth = getAuth(app);

  useEffect(() => {
    fetchWorkers();
  }, []);

  const fetchWorkers = async () => {
    try {
      const workersRef = ref(db, 'temporaryWorkers');
      const snapshot = await get(workersRef);
      if (snapshot.exists()) {
        const workersData = Object.entries(snapshot.val()).map(([id, data]) => ({
          id,
          ...data,
        }));
        setWorkers(workersData);
      }
      setLoading(false);
    } catch (error) {
      console.error('Error fetching workers:', error);
      toast.error('Error loading temporary workers');
      setLoading(false);
    }
  };

  const handleEdit = (worker) => {
    setEditingWorker(worker);
    setShowModal(true);
  };

  const handleDelete = async (workerId) => {
    if (window.confirm('Are you sure you want to delete this worker?')) {
      try {
        await remove(ref(db, `temporaryWorkers/${workerId}`));
        toast.success('Worker deleted successfully');
        fetchWorkers();
      } catch (error) {
        console.error('Error deleting worker:', error);
        toast.error('Error deleting worker');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const workerData = {
        name: e.target.name.value,
        email: e.target.email.value,
        phone: e.target.phone.value,
        location: e.target.location.value,
        canDoStrenuousWork: e.target.canDoStrenuousWork.checked,
        whatsappContact: e.target.whatsappContact.checked,
        status: 'active',
        listedDate: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      if (editingWorker) {
        await set(ref(db, `temporaryWorkers/${editingWorker.id}`), {
          ...editingWorker,
          ...workerData,
        });
        toast.success('Worker updated successfully');
      } else {
        await push(ref(db, 'temporaryWorkers'), {
          ...workerData,
          createdAt: new Date().toISOString(),
        });
        toast.success('Worker added successfully');
      }

      setShowModal(false);
      setEditingWorker(null);
      fetchWorkers();
    } catch (error) {
      console.error('Error saving worker:', error);
      toast.error('Error saving worker');
    }
  };

  const exportToExcel = () => {
    const workersForExport = workers.map(worker => ({
      Name: worker.name,
      Email: worker.email,
      Phone: worker.phone,
      Location: worker.location,
      'Can Do Strenuous Work': worker.canDoStrenuousWork ? 'Yes' : 'No',
      'WhatsApp Contact': worker.whatsappContact ? 'Yes' : 'No',
      Status: worker.status,
      'Listed Date': worker.listedDate
    }));

    const ws = XLSX.utils.json_to_sheet(workersForExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Temporary Workers");
    XLSX.writeFile(wb, "TemporaryWorkers.xlsx");
  };

  if (loading) {
    return <div className="flex justify-center items-center h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Temporary Workers</h1>
        <div>
          <button
            onClick={exportToExcel}
            className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mr-2"
          >
            <FaFileExcel className="inline mr-2" /> Export to Excel
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
          >
            <FaPlus className="inline mr-2" /> Add Worker
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white">
          <thead>
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">Email</th>
              <th className="px-4 py-2">Phone</th>
              <th className="px-4 py-2">Location</th>
              <th className="px-4 py-2">Strenuous Work</th>
              <th className="px-4 py-2">WhatsApp</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {workers.map((worker) => (
              <tr key={worker.id}>
                <td className="border px-4 py-2">{worker.name}</td>
                <td className="border px-4 py-2">{worker.email}</td>
                <td className="border px-4 py-2">{worker.phone}</td>
                <td className="border px-4 py-2">{worker.location}</td>
                <td className="border px-4 py-2">
                  {worker.canDoStrenuousWork ? 'Yes' : 'No'}
                </td>
                <td className="border px-4 py-2">
                  {worker.whatsappContact ? 'Yes' : 'No'}
                </td>
                <td className="border px-4 py-2">{worker.status}</td>
                <td className="border px-4 py-2">
                  <button
                    onClick={() => handleEdit(worker)}
                    className="text-blue-500 hover:text-blue-700 mr-2"
                  >
                    <FaEdit />
                  </button>
                  <button
                    onClick={() => handleDelete(worker.id)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <FaTrash />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <h3 className="text-lg font-bold mb-4">
              {editingWorker ? 'Edit Worker' : 'Add New Worker'}
            </h3>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                  Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  defaultValue={editingWorker?.name}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  defaultValue={editingWorker?.email}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
                  Phone
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  defaultValue={editingWorker?.phone}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
                  Location
                </label>
                <input
                  type="text"
                  id="location"
                  name="location"
                  defaultValue={editingWorker?.location}
                  className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                  required
                />
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    id="canDoStrenuousWork"
                    name="canDoStrenuousWork"
                    defaultChecked={editingWorker?.canDoStrenuousWork}
                    className="mr-2"
                  />
                  <span className="text-gray-700 text-sm font-bold">Can Do Strenuous Work</span>
                </label>
              </div>
              <div className="mb-4">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    id="whatsappContact"
                    name="whatsappContact"
                    defaultChecked={editingWorker?.whatsappContact}
                    className="mr-2"
                  />
                  <span className="text-gray-700 text-sm font-bold">WhatsApp Contact</span>
                </label>
              </div>
              <div className="flex items-center justify-between">
                <button
                  type="submit"
                  className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  {editingWorker ? 'Update' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingWorker(null);
                  }}
                  className="bg-gray-500 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminTemporaryWorkersList;