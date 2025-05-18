// frontend/src/components/common/Modal.js
import React from 'react';
import PropTypes from 'prop-types';
import styles from './Modal.module.css'; // You'll need to create this CSS file

const Modal = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) {
        return null;
    }

    return (
        <div className={styles.modalOverlay} onClick={onClose}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                <div className={styles.modalHeader}>
                    <h3 className={styles.modalTitle}>{title}</h3>
                    <button onClick={onClose} className={styles.closeButton}>&times;</button>
                </div>
                <div className={styles.modalBody}>
                    {children}
                </div>
            </div>
        </div>
    );
};

Modal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    title: PropTypes.string,
    children: PropTypes.node.isRequired,
};

Modal.defaultProps = {
    title: 'Modal Title',
};

export default Modal;