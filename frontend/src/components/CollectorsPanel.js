// frontend/src/components/CollectorsPanel.js
// ----- START OF COMPLETE MODIFIED FILE (v1.1 - Integrated CollectorFormModal) -----
import React, { useState } from 'react';
import styles from './CollectorsPanel.module.css';
import surveyApi from '../api/surveyApi';
import { toast } from 'react-toastify';
import CollectorFormModal from './CollectorFormModal'; // <<<--- IMPORT ACTUAL COMPONENT

const CollectorsPanel = ({
    isOpen,
    onClose,
    surveyId,
    collectors: initialCollectors,
    onCollectorsUpdate,
    isLoading
}) => {
    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingCollector, setEditingCollector] = useState(null);

    if (!isOpen) {
        return null;
    }

    const handleAddNewCollector = () => {
        setEditingCollector(null);
        setIsFormModalOpen(true);
    };

    const handleEditCollector = (collector) => {
        setEditingCollector(collector);
        setIsFormModalOpen(true);
    };

    const handleDeleteCollector = async (collectorId) => {
        // Find collector name for confirmation message
        const collectorToDelete = initialCollectors.find(c => c._id === collectorId);
        const collectorName = collectorToDelete ? collectorToDelete.name : "this collector";
        
        if (!window.confirm(`Are you sure you want to delete the collector "${collectorName}"? This action cannot be undone.`)) {
            return;
        }
        try {
            await surveyApi.deleteCollector(surveyId, collectorId);
            toast.success(`Collector "${collectorName}" deleted successfully!`);
            if (onCollectorsUpdate) {
                onCollectorsUpdate();
            }
        } catch (error) {
            console.error("Error deleting collector:", error);
            toast.error(`Failed to delete collector: ${error.response?.data?.message || error.message || 'Unknown error'}`);
        }
    };
    
    const handleFormModalSave = () => {
        setIsFormModalOpen(false);
        setEditingCollector(null);
        if (onCollectorsUpdate) {
            onCollectorsUpdate(); 
        }
    };

    const getCollectorLink = (collector) => {
        const publicBaseUrl = process.env.REACT_APP_PUBLIC_SURVEY_URL || window.location.origin;
        return `${publicBaseUrl}/s/${collector.linkId}`;
    };

    const copyToClipboard = (text) => {
        navigator.clipboard.writeText(text).then(() => {
            toast.success("Link copied to clipboard!");
        }).catch(err => {
            toast.error("Failed to copy link.");
            console.error('Failed to copy text: ', err);
        });
    };

    const formatDate = (dateString) => {
        if (!dateString) return 'N/A';
        try {
            return new Date(dateString).toLocaleString(undefined, { 
                year: 'numeric', month: 'short', day: 'numeric', 
                hour: 'numeric', minute: '2-digit', hour12: true 
            });
        } catch (e) {
            return 'Invalid Date';
        }
    };


    return (
        <div className={styles.panelOverlay}>
            <div className={styles.panel}>
                <div className={styles.header}>
                    <h2>Manage Collectors</h2>
                    <button onClick={onClose} className={styles.closeButton}>&times;</button>
                </div>

                <div className={styles.toolbar}>
                    <button
                        onClick={handleAddNewCollector}
                        className="button button-primary"
                        disabled={isLoading}
                    >
                        + Add New Web Link Collector
                    </button>
                </div>

                <div className={styles.content}>
                    {isLoading && <p className={styles.loadingMessage}>Loading collectors...</p>}
                    {!isLoading && initialCollectors.length === 0 && (
                        <p className={styles.noCollectorsMessage}>No collectors created yet. Click "Add New Web Link Collector" to get started.</p>
                    )}
                    {!isLoading && initialCollectors.length > 0 && (
                        <ul className={styles.collectorList}>
                            {initialCollectors.map(collector => (
                                <li key={collector._id} className={styles.collectorItem}>
                                    <div className={styles.collectorInfo}>
                                        <div className={styles.collectorNameSection}>
                                            <strong className={styles.collectorName}>{collector.name}</strong>
                                            <span className={`${styles.collectorStatus} ${styles[collector.status?.toLowerCase() || 'unknown']}`}>
                                                {collector.status?.replace('_', ' ') || 'Unknown'}
                                            </span>
                                        </div>
                                        <div className={styles.collectorDetailsGrid}>
                                            <span>Type:</span><span>{collector.type?.replace('_', ' ') || 'N/A'}</span>
                                            <span>Responses:</span>
                                            <span>
                                                {collector.responseCount || 0}
                                                {collector.settings?.web_link?.maxResponses > 0 ? ` / ${collector.settings.web_link.maxResponses}` : ''}
                                            </span>
                                            <span>Open Date:</span><span>{formatDate(collector.settings?.web_link?.openDate)}</span>
                                            <span>Close Date:</span><span>{formatDate(collector.settings?.web_link?.closeDate)}</span>
                                            <span>Multiple Responses:</span><span>{collector.settings?.web_link?.allowMultipleResponses ? 'Allowed' : 'Not Allowed'}</span>
                                            <span>Password:</span><span>{collector.settings?.web_link?.passwordProtectionEnabled ? 'Enabled' : 'Disabled'}</span>
                                        </div>
                                        
                                        {collector.type === 'web_link' && collector.linkId && (
                                            <div className={styles.collectorLinkSection}>
                                                <span>Link:</span>
                                                <input type="text" readOnly value={getCollectorLink(collector)} className={styles.linkInput} onClick={(e) => e.target.select()}/>
                                                <button onClick={() => copyToClipboard(getCollectorLink(collector))} className={`${styles.actionButtonSmall} button-outline`}>Copy</button>
                                            </div>
                                        )}
                                    </div>
                                    <div className={styles.collectorActions}>
                                        <button onClick={() => handleEditCollector(collector)} className="button button-secondary button-small">Edit</button>
                                        <button onClick={() => handleDeleteCollector(collector._id)} className="button button-danger button-small">Delete</button>
                                        {/* Add more actions like 'View Responses', 'Pause', 'Close' etc. later */}
                                        {/* Example: <button className="button button-tertiary button-small">View Responses</button> */}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                
                {isFormModalOpen && (
                    <CollectorFormModal
                        isOpen={isFormModalOpen}
                        onClose={() => {
                            setIsFormModalOpen(false);
                            setEditingCollector(null); // Clear editing state on close
                        }}
                        surveyId={surveyId}
                        existingCollector={editingCollector}
                        onSave={handleFormModalSave} // This calls onCollectorsUpdate in parent
                    />
                )}

                <div className={styles.footer}>
                    <button onClick={onClose} className="button">Close Panel</button>
                </div>
            </div>
        </div>
    );
};

export default CollectorsPanel;
// ----- END OF COMPLETE MODIFIED FILE (v1.1) -----