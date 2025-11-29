import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5002';

function NotesPanel({ selectedRegion }) {
    const [notes, setNotes] = useState([]);
    const [newNote, setNewNote] = useState('');
    const [waterLevel, setWaterLevel] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (selectedRegion) {
            fetchNotes();
        }
    }, [selectedRegion]);

    const fetchNotes = async () => {
        try {
            const res = await axios.get(`${API_URL}/api/notes?region=${selectedRegion}`);
            setNotes(res.data);
        } catch (err) {
            console.error("Failed to fetch notes", err);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!newNote.trim()) return;

        try {
            setLoading(true);
            const res = await axios.post(`${API_URL}/api/notes`, {
                regionId: selectedRegion,
                text: newNote,
                water_level: waterLevel
            });
            setNotes([res.data, ...notes]);
            setNewNote('');
            setWaterLevel('');
        } catch (err) {
            console.error("Failed to save note", err);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            await axios.delete(`${API_URL}/api/notes/${id}`);
            setNotes(notes.filter(n => n.id !== id));
        } catch (err) {
            console.error("Failed to delete note", err);
        }
    }

    if (!selectedRegion) return null;

    return (
        <div className="zen-panel notes-panel">
            <h3>Field Notes</h3>

            <form onSubmit={handleSubmit} className="notes-form">
                <div className="form-row">
                    <input
                        type="number"
                        step="0.01"
                        placeholder="Water Level (m)"
                        value={waterLevel}
                        onChange={(e) => setWaterLevel(e.target.value)}
                        className="zen-input"
                        style={{ marginBottom: '0.5rem' }}
                    />
                </div>
                <textarea
                    placeholder="Record observation..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="zen-input"
                    rows="2"
                />
                <button type="submit" className="zen-btn primary" disabled={loading} style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}>
                    {loading ? 'Saving...' : 'Add Note'}
                </button>
            </form>

            <div className="notes-list">
                {notes.length === 0 ? (
                    <p className="no-notes">No notes recorded.</p>
                ) : (
                    notes.map(note => (
                        <div key={note.id} className="note-item">
                            <div className="note-header">
                                <span className="note-date">
                                    {new Date(note.timestamp).toLocaleString(undefined, {
                                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                                {note.water_level && (
                                    <span className="note-level">WL: {note.water_level}m</span>
                                )}
                                <button onClick={() => handleDelete(note.id)} className="delete-btn" title="Delete">×</button>
                            </div>
                            <p className="note-text">{note.text}</p>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default NotesPanel;
