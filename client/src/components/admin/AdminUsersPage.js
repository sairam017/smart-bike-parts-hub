import React, { useEffect, useState } from 'react';
import api from '../../services/api';
import adminService from '../../services/adminService';

const AdminUsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  useEffect(() => {
    setLoading(true);
    api.get('/admin/users').then(({data})=> setUsers(data)).catch(e=> setError(e.response?.data?.message||e.message)).finally(()=> setLoading(false));
  }, []);
  const remove = async (id) => {
    if (!window.confirm('Delete this user?')) return;
    try {
      await adminService.deleteUser(id);
      setUsers(u => u.filter(x=> x._id !== id));
    } catch(e){
      alert(e.response?.data?.message || 'Delete failed');
    }
  };

  return (
    <div style={{minHeight:'100vh', background:'#fff'}}>
      <div style={{background:'#0a2aa7', color:'#fff', padding:'0.75rem 1rem', fontWeight:800}}>Users</div>
      <div style={{padding:'1rem 1.25rem'}}>
        {loading && 'Loading...'}
        {error && <div style={{color:'red'}}>{error}</div>}
    <table style={{width:'100%', borderCollapse:'collapse'}}>
          <thead>
      <tr><th align="left">Name</th><th align="left">Email</th><th align="left">Role</th><th align="left">Actions</th></tr>
          </thead>
          <tbody>
            {users.map(u=> (
              <tr key={u._id} style={{borderTop:'1px solid #e5e7eb'}}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>{u.role}</td>
        <td>{u.role !== 'admin' && <button onClick={()=> remove(u._id)} style={{fontSize:11, background:'#b91c1c', color:'#fff', border:'none', padding:'4px 8px', borderRadius:4, cursor:'pointer'}}>Delete</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminUsersPage;
