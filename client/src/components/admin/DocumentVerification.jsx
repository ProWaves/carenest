// client/src/components/admin/DocumentVerification.jsx
import React, { useState, useEffect } from 'react';
import API from '../../api/axios';
import { useToast } from '../Toast';

function DocumentVerification({ onUpdate }) {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [filter, setFilter] = useState('pending');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [showRevisionModal, setShowRevisionModal] = useState(false);
  const [currentDocId, setCurrentDocId] = useState(null);
  const { addToast } = useToast();

  useEffect(() => {
    loadDocuments();
  }, [filter]);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const res = await API.get(`/admin/documents?status=${filter}`);
      setDocuments(res.data);
    } catch (error) {
      addToast('Failed to load documents', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (docId, isVerified, rejectionReason = null) => {
    try {
      await API.put(`/admin/documents/${docId}/verify`, { 
        is_verified: isVerified,
        rejection_reason: rejectionReason,
        admin_notes: rejectionReason
      });
      
      addToast(`Document ${isVerified ? 'verified' : 'rejected'} successfully`, 'success');
      loadDocuments();
      if (onUpdate) onUpdate();
    } catch (error) {
      addToast('Failed to verify document', 'error');
    }
  };

  const handleRequestRevision = async () => {
    try {
      if (!revisionNotes.trim()) {
        addToast('Please provide revision notes', 'error');
        return;
      }

      await API.post(`/admin/documents/${currentDocId}/request-revision`, {
        revision_notes: revisionNotes
      });

      addToast('Revision requested successfully', 'success');
      setShowRevisionModal(false);
      setRevisionNotes('');
      loadDocuments();
    } catch (error) {
      addToast('Failed to request revision', 'error');
    }
  };

  const getDocumentTypeLabel = (type) => {
    const types = {
      'id_card': '🪪 ID Card',
      'cv': '📄 CV/Resume',
      'certificate': '📜 Certificate',
      'background_check': '🔍 Background Check',
    };
    return types[type] || type;
  };

  const getStatusBadge = (doc) => {
    if (doc.is_verified) {
      return <span className="badge badge-success">✅ Verified</span>;
    }
    if (doc.rejection_reason) {
      return <span className="badge badge-danger">🔄 Revision Needed</span>;
    }
    return <span className="badge badge-warning">⏳ Pending</span>;
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading documents...</p>
      </div>
    );
  }

  return (
    <div className="document-verification">
      <div className="document-header">
        <h2>📄 Document Verification</h2>
        <div className="document-stats">
          <span>Total: {documents.length}</span>
          <span className="pending">
            Pending: {documents.filter(d => !d.is_verified && !d.rejection_reason).length}
          </span>
          <span className="revision">
            Revision: {documents.filter(d => d.rejection_reason).length}
          </span>
        </div>
      </div>

      <div className="filter-tabs">
        <button 
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          All ({documents.length})
        </button>
        <button 
          className={`filter-tab ${filter === 'pending' ? 'active' : ''}`}
          onClick={() => setFilter('pending')}
        >
          Pending ({documents.filter(d => !d.is_verified && !d.rejection_reason).length})
        </button>
        <button 
          className={`filter-tab ${filter === 'revision' ? 'active' : ''}`}
          onClick={() => setFilter('revision')}
        >
          Revision Needed ({documents.filter(d => d.rejection_reason).length})
        </button>
        <button 
          className={`filter-tab ${filter === 'verified' ? 'active' : ''}`}
          onClick={() => setFilter('verified')}
        >
          Verified ({documents.filter(d => d.is_verified).length})
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✅</div>
          <h3>No Documents to Display</h3>
          <p>All documents have been processed.</p>
        </div>
      ) : (
        <div className="documents-grid">
          {documents.map((doc) => (
            <div key={doc.id} className="document-card">
              <div className="doc-card-header">
                <div className="doc-user-info">
                  <div className="doc-avatar">
                    {doc.first_name?.[0]}{doc.last_name?.[0]}
                  </div>
                  <div>
                    <h4>{doc.first_name} {doc.last_name}</h4>
                    <p className="doc-email">{doc.email}</p>
                  </div>
                </div>
                {getStatusBadge(doc)}
              </div>

              <div className="doc-card-body">
                <div className="doc-details">
                  <div className="doc-detail-item">
                    <span className="label">Document Type:</span>
                    <span className="value">{getDocumentTypeLabel(doc.document_type)}</span>
                  </div>
                  <div className="doc-detail-item">
                    <span className="label">Uploaded:</span>
                    <span className="value">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </span>
                  </div>
                  {doc.hourly_rate && (
                    <div className="doc-detail-item">
                      <span className="label">Hourly Rate:</span>
                      <span className="value">${doc.hourly_rate}/hr</span>
                    </div>
                  )}
                  {doc.rejection_reason && (
                    <div className="doc-detail-item" style={{ gridColumn: '1 / -1' }}>
                      <span className="label" style={{ color: '#ef4444' }}>Revision Notes:</span>
                      <span className="value" style={{ color: '#ef4444' }}>{doc.rejection_reason}</span>
                    </div>
                  )}
                </div>

                <div className="doc-preview">
                  <button 
                    className="btn btn-view-doc"
                    onClick={() => setSelectedDoc(doc)}
                  >
                    👁️ View Document
                  </button>
                </div>
              </div>

              {!doc.is_verified && (
                <div className="doc-card-footer">
                  <button 
                    className="btn btn-verify"
                    onClick={() => handleVerify(doc.id, true)}
                  >
                    ✓ Approve
                  </button>
                  <button 
                    className="btn btn-revision"
                    onClick={() => {
                      setCurrentDocId(doc.id);
                      setShowRevisionModal(true);
                    }}
                  >
                    🔄 Request Revision
                  </button>
                  <button 
                    className="btn btn-reject"
                    onClick={() => handleVerify(doc.id, false, 'Document rejected by admin')}
                  >
                    ✗ Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Document Viewer Modal */}
      {selectedDoc && (
        <div className="modal-overlay" onClick={() => setSelectedDoc(null)}>
          <div className="modal document-viewer" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{getDocumentTypeLabel(selectedDoc.document_type)} - {selectedDoc.first_name} {selectedDoc.last_name}</h3>
              <button className="modal-close" onClick={() => setSelectedDoc(null)}>×</button>
            </div>
            <div className="modal-body">
              {selectedDoc.document_url?.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                <img src={selectedDoc.document_url} alt="Document" style={{ maxWidth: '100%', maxHeight: '70vh' }} />
              ) : (
                <iframe src={selectedDoc.document_url} title="Document Preview" style={{ width: '100%', height: '70vh', border: 'none', background: '#f5f5f5' }} />
              )}
            </div>
            <div className="modal-footer">
              {!selectedDoc.is_verified && (
                <>
                  <button className="btn btn-verify" onClick={() => { handleVerify(selectedDoc.id, true); setSelectedDoc(null); }}>
                    ✓ Approve
                  </button>
                  <button className="btn btn-revision" onClick={() => { setCurrentDocId(selectedDoc.id); setShowRevisionModal(true); setSelectedDoc(null); }}>
                    🔄 Request Revision
                  </button>
                </>
              )}
              <button className="btn btn-secondary" onClick={() => setSelectedDoc(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Revision Request Modal */}
      {showRevisionModal && (
        <div className="modal-overlay" onClick={() => setShowRevisionModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>🔄 Request Document Revision</h3>
              <button className="modal-close" onClick={() => setShowRevisionModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Revision Notes <span style={{ color: '#ef4444' }}>*</span></label>
                <textarea
                  value={revisionNotes}
                  onChange={(e) => setRevisionNotes(e.target.value)}
                  placeholder="Please explain what needs to be changed..."
                  rows={5}
                  required
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowRevisionModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleRequestRevision}>Send Revision Request</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DocumentVerification;