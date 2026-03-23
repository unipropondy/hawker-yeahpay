// src/components/DishGroupManagement.tsx
import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DraggableFlatList, {
  ScaleDecorator,
  RenderItemParams
} from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import API from '../api';

interface DishGroup {
  id: number;
  name: string;
  itemCount: number;
  active: boolean;
  order?: number;
  isDynamic?: boolean;  // ✅ NEW: Mark dynamic groups like Favourites
}

interface DishGroupManagementProps {
  dishGroups: DishGroup[];
  setDishGroups: (groups: DishGroup[]) => void;
  categories: string[];
  setCategories: (categories: string[]) => void;
  setActiveCategory: (category: string) => void;
  currentTheme: any;
  t: any;
  onGroupUpdate: () => void;
}

export const DishGroupManagement: React.FC<DishGroupManagementProps> = ({
  dishGroups,
  setDishGroups,
  categories,
  setCategories,
  setActiveCategory,
  currentTheme,
  t,
  onGroupUpdate,
}) => {
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showEditGroup, setShowEditGroup] = useState(false);
  const [editingGroup, setEditingGroup] = useState<DishGroup | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [formActive, setFormActive] = useState(true);
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  // ✅ Filter groups for display (hide empty Favourites)
  const displayGroups = dishGroups.filter(group => {
    // Hide Favourites if it has 0 items AND is dynamic
    if (group.name === 'Favourites' && group.itemCount === 0 && group.isDynamic) {
      return false;
    }
    return true;
  });

  // Add Group - Prevent manual creation of Favourites
  const handleAddGroup = async (): Promise<void> => {
    if (!newGroupName.trim()) {
      Alert.alert(t.error, 'Please enter group name');
      return;
    }

    // ✅ Prevent manual creation of Favourites group
    if (newGroupName.trim().toLowerCase() === 'favourites') {
      Alert.alert('Error', 'Favourites group is automatically managed');
      return;
    }

    setLoading(true);
    try {
      const response = await API.post('/dishgroups', {
        name: newGroupName.trim(),
        active: formActive
      });

      const newGroup = {
        id: response.data.Id,
        name: response.data.Name,
        itemCount: 0,
        active: response.data.active ?? formActive,
        isDynamic: false,  // ✅ Manual groups are not dynamic
      };

      const updatedGroups = [...dishGroups, newGroup];
      setDishGroups(updatedGroups);
      
      // ✅ Update categories (include Favourites only if it has items)
      const updatedCategories = updatedGroups
        .filter(g => g.active !== false && (g.name !== 'Favourites' || g.itemCount > 0))
        .map(g => g.name);
      setCategories(updatedCategories);
      
      setNewGroupName('');
      setFormActive(true);
      setShowAddGroup(false);
      
      await saveOrderToBackend(updatedGroups);
      onGroupUpdate();
      
    } catch (error) {
      Alert.alert(t.error, 'Failed to add dish group');
    } finally {
      setLoading(false);
    }
  };

  const handleEditGroup = async (): Promise<void> => {
    if (!editingGroup || !newGroupName.trim()) return;
    
    // ✅ Prevent editing Favourites group name
    if (editingGroup.name === 'Favourites') {
      Alert.alert('Error', 'Favourites group cannot be edited');
      return;
    }

    setLoading(true);
    try {
      const oldName = editingGroup.name;
      
      await API.put(`/dishgroups/${editingGroup.id}`, {
        name: newGroupName.trim(),
        active: formActive
      });

      const updatedGroups = dishGroups.map(group =>
        group.id === editingGroup.id
          ? { ...group, name: newGroupName.trim(), active: formActive }
          : group
      );
      
      setDishGroups(updatedGroups);

      // ✅ Update categories (preserve Favourites if it has items)
      const updatedCategories = updatedGroups
        .filter(g => g.active !== false && (g.name !== 'Favourites' || g.itemCount > 0))
        .map(g => g.name);
      setCategories(updatedCategories);

      if (oldName === categories[0]) {
        setActiveCategory(newGroupName.trim());
      }

      setEditingGroup(null);
      setNewGroupName('');
      setFormActive(true);
      setShowEditGroup(false);
      
      onGroupUpdate();
      
    } catch (error: any) {
      Alert.alert(t.error || '❌ Error', 'Failed to edit dish group');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (group: DishGroup) => {
    // ✅ Prevent deactivating Favourites
    if (group.name === 'Favourites') {
      Alert.alert('Error', 'Favourites group cannot be deactivated');
      return;
    }
    
    setLoading(true);
    try {
      const newActiveState = !group.active;
      
      await API.put(`/dishgroups/${group.id}`, {
        name: group.name,
        active: newActiveState
      });

      const updatedGroups = dishGroups.map(g =>
        g.id === group.id ? { ...g, active: newActiveState } : g
      );
      setDishGroups(updatedGroups);
      
      // ✅ Update categories display
      const updatedCategories = updatedGroups
        .filter(g => g.active !== false && (g.name !== 'Favourites' || g.itemCount > 0))
        .map(g => g.name);
      setCategories(updatedCategories);
      
      onGroupUpdate();
      
    } catch (error) {
      Alert.alert(t.error, 'Failed to update status');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteGroup = (group: DishGroup): void => {
    // ✅ Prevent deleting Favourites group
    if (group.name === 'Favourites') {
      Alert.alert('Error', 'Favourites group cannot be deleted');
      return;
    }
    
    Alert.alert(
      t.delete,
      `${t.confirmDelete} "${group.name}"? ${t.thisWillDelete}`,
      [
        { text: t.no, style: 'cancel' },
        {
          text: t.yes,
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              await API.delete(`/dishgroups/${group.id}`);

              const updatedGroups = dishGroups.filter(g => g.id !== group.id);
              const updatedCategories = updatedGroups
                .filter(g => g.active !== false && (g.name !== 'Favourites' || g.itemCount > 0))
                .map(g => g.name);

              setDishGroups(updatedGroups);
              setCategories(updatedCategories);

              if (group.name === categories[0] && updatedCategories.length > 0) {
                setActiveCategory(updatedCategories[0]);
              }

              await saveOrderToBackend(updatedGroups);
              onGroupUpdate();
              
            } catch (error) {
              Alert.alert(t.error, 'Failed to delete dish group');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const saveOrderToBackend = async (groups: DishGroup[]) => {
    try {
      // ✅ Filter out dynamic groups from order saving? Or keep them at bottom
      const orderData = groups
        .filter(g => g.name !== 'Favourites') // Favourites always at bottom?
        .map((group, index) => ({
          id: group.id,
          order: index
        }));
      
      await API.post('/dishgroups/update-order', { groups: orderData });
      
    } catch (error) {
      console.log('❌ Failed to save order:', error);
    }
  };

  const handleDragEnd = async ({ data }: { data: DishGroup[] }) => {
    // ✅ Ensure Favourites stays at bottom if it exists
    const favourites = data.find(g => g.name === 'Favourites');
    const otherGroups = data.filter(g => g.name !== 'Favourites');
    
    let finalData = otherGroups;
    if (favourites && favourites.itemCount > 0) {
      finalData = [...otherGroups, favourites];
    }
    
    setDishGroups(finalData);
    await saveOrderToBackend(finalData);
    setIsDragging(false);
    onGroupUpdate();
  };

  const openEditForm = (group: DishGroup) => {
    // ✅ Prevent editing Favourites
    if (group.name === 'Favourites') {
      Alert.alert('Info', 'Favourites group is automatically managed');
      return;
    }
    setEditingGroup(group);
    setNewGroupName(group.name);
    setFormActive(group.active);
    setShowEditGroup(true);
  };

  const renderItem = useCallback(({ item, drag, isActive }: RenderItemParams<DishGroup>) => {
    // ✅ Disable drag for Favourites
    const canDrag = item.name !== 'Favourites';
    
    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={!loading && canDrag ? drag : null}
          delayLongPress={200}
          style={[
            styles.groupCard,
            {
              backgroundColor: currentTheme.card,
              borderColor: currentTheme.border,
              opacity: item.active ? 1 : 0.6,
              transform: [{ scale: isActive ? 1.02 : 1 }],
              ...(item.name === 'Favourites' && styles.favouritesGroup)
            }
          ]}
        >
          <View style={styles.groupInfo}>
            <Ionicons 
              name={item.name === 'Favourites' ? "star" : "menu"} 
              size={24} 
              color={item.name === 'Favourites' ? currentTheme.warning : (isActive ? currentTheme.primary : currentTheme.textSecondary)} 
              style={styles.dragIcon}
            />
            
            <View style={styles.groupNameContainer}>
              <Text style={[styles.groupName, { color: currentTheme.text }]}>
                {item.name} {item.name === 'Favourites' && '⭐'}
              </Text>
              <Text style={[styles.groupCount, { color: currentTheme.textSecondary }]}>
                {item.itemCount || 0} {t.items_lower}
              </Text>
            </View>
          </View>

          <View style={styles.groupActions}>
            {/* ✅ Hide actions for Favourites */}
            {item.name !== 'Favourites' && (
              <>
                <TouchableOpacity
                  style={[styles.actionBtn, { 
                    backgroundColor: item.active ? currentTheme.success : currentTheme.inactive 
                  }]}
                  onPress={() => toggleActive(item)}
                  disabled={loading}
                >
                  <Ionicons name={item.active ? "eye" : "eye-off"} size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: currentTheme.primary }]}
                  onPress={() => openEditForm(item)}
                  disabled={loading}
                >
                  <Ionicons name="pencil" size={18} color="#fff" />
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: currentTheme.danger }]}
                  onPress={() => handleDeleteGroup(item)}
                  disabled={loading}
                >
                  <Ionicons name="trash" size={18} color="#fff" />
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  }, [currentTheme, loading, t]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1, backgroundColor: currentTheme.background }}>
        <View style={[styles.container, { backgroundColor: currentTheme.background }]}>
          
          {/* Header Section */}
          <View>
            <Text style={[styles.title, { color: currentTheme.text }]}>
              {t.dishGroupManagement}
            </Text>

            <Text style={[styles.dragHint, { color: currentTheme.textSecondary }]}>
              👆 Long press and drag to reorder groups
            </Text>

            <TouchableOpacity
              style={[styles.addButton, { backgroundColor: currentTheme.secondary }]}
              onPress={() => {
                setFormActive(true);
                setShowAddGroup(true);
              }}
              disabled={loading}
            >
              <Text style={styles.addButtonText}>{t.addNewGroup}</Text>
            </TouchableOpacity>
          </View>

          {/* Loading Indicator */}
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={currentTheme.primary} />
            </View>
          )}

          {/* Draggable List */}
          <View style={{ flex: 1, marginTop: 10 }}>
            <DraggableFlatList
              data={displayGroups}
              onDragEnd={handleDragEnd}
              keyExtractor={(item) => `group-${item.id}`}
              renderItem={renderItem}
              contentContainerStyle={{ 
                paddingBottom: 20,
                flexGrow: 1
              }}
              showsVerticalScrollIndicator={true}
              bounces={true}
              alwaysBounceVertical={true}
              onDragBegin={() => setIsDragging(true)}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <Text style={{ color: currentTheme.textSecondary }}>
                    No groups yet. Tap "Add New Group" to create one.
                  </Text>
                </View>
              }
            />
          </View>

          {/* Add Group Modal */}
          <Modal visible={showAddGroup} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: currentTheme.card }]}>
                <Text style={[styles.modalTitle, { color: currentTheme.text }]}>{t.addNewGroup}</Text>
                
                <TextInput
                  style={[styles.modalInput, { 
                    backgroundColor: currentTheme.surface, 
                    borderColor: currentTheme.border, 
                    color: currentTheme.text 
                  }]}
                  placeholder={t.groupName}
                  placeholderTextColor={currentTheme.textSecondary}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  editable={!loading}
                />

                <View style={styles.activeRow}>
                  <Text style={[styles.activeLabel, { color: currentTheme.text }]}>Active</Text>
                  <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: currentTheme.inactive, true: currentTheme.success }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn, { backgroundColor: currentTheme.surface }]}
                    onPress={() => {
                      setShowAddGroup(false);
                      setNewGroupName('');
                      setFormActive(true);
                    }}
                    disabled={loading}
                  >
                    <Text style={[styles.cancelBtnText, { color: currentTheme.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.saveBtn, { backgroundColor: currentTheme.primary }]}
                    onPress={handleAddGroup}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t.save}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>

          {/* Edit Group Modal */}
          <Modal visible={showEditGroup} transparent animationType="slide">
            <View style={styles.modalOverlay}>
              <View style={[styles.modalContent, { backgroundColor: currentTheme.card }]}>
                <Text style={[styles.modalTitle, { color: currentTheme.text }]}>{t.edit}</Text>
                
                <TextInput
                  style={[styles.modalInput, { 
                    backgroundColor: currentTheme.surface, 
                    borderColor: currentTheme.border, 
                    color: currentTheme.text 
                  }]}
                  placeholder={t.groupName}
                  placeholderTextColor={currentTheme.textSecondary}
                  value={newGroupName}
                  onChangeText={setNewGroupName}
                  editable={!loading}
                />

                <View style={styles.activeRow}>
                  <Text style={[styles.activeLabel, { color: currentTheme.text }]}>Active</Text>
                  <Switch
                    value={formActive}
                    onValueChange={setFormActive}
                    trackColor={{ false: currentTheme.inactive, true: currentTheme.success }}
                    thumbColor="#fff"
                  />
                </View>

                <View style={styles.modalButtons}>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.cancelBtn, { backgroundColor: currentTheme.surface }]}
                    onPress={() => {
                      setShowEditGroup(false);
                      setEditingGroup(null);
                      setNewGroupName('');
                      setFormActive(true);
                    }}
                    disabled={loading}
                  >
                    <Text style={[styles.cancelBtnText, { color: currentTheme.text }]}>{t.cancel}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalBtn, styles.saveBtn, { backgroundColor: currentTheme.primary }]}
                    onPress={handleEditGroup}
                    disabled={loading}
                  >
                    {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.saveBtnText}>{t.update}</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 16 
  },
  title: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 8, 
    includeFontPadding: false 
  },
  dragHint: { 
    fontSize: 12, 
    marginBottom: 12, 
    fontStyle: 'italic',
    includeFontPadding: false 
  },
  addButton: { 
    padding: 14, 
    borderRadius: 10, 
    alignItems: 'center', 
    marginBottom: 16, 
    minHeight: 50, 
    justifyContent: 'center' 
  },
  addButtonText: { 
    color: '#ffffff', 
    fontSize: 15, 
    fontWeight: '600', 
    includeFontPadding: false 
  },
  loadingContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -15 }, { translateY: -15 }],
    zIndex: 1000,
  },
  groupCard: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 10, 
    marginBottom: 8, 
    borderWidth: 1,
    minHeight: 70,
  },
  favouritesGroup: {
    backgroundColor: 'rgba(255, 193, 7, 0.1)',
    borderColor: '#FFC107',
  },
  groupInfo: { 
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dragIcon: {
    padding: 4,
    marginRight: 8,
  },
  groupNameContainer: {
    flex: 1,
  },
  groupName: { 
    fontSize: 15, 
    fontWeight: '600', 
    marginBottom: 2,
    includeFontPadding: false 
  },
  groupCount: { 
    fontSize: 12,
    includeFontPadding: false 
  },
  groupActions: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6,
  },
  actionBtn: {
    width: 34,
    height: 34,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    padding: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0,0,0,0.5)', 
    justifyContent: 'center', 
    padding: 16 
  },
  modalContent: { 
    borderRadius: 16, 
    padding: 20 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 16, 
    textAlign: 'center', 
    includeFontPadding: false 
  },
  modalInput: { 
    borderWidth: 1, 
    borderRadius: 8, 
    padding: 12, 
    fontSize: 14, 
    marginBottom: 16, 
    minHeight: 50 
  },
  activeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  activeLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  modalButtons: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    marginTop: 8 
  },
  modalBtn: { 
    flex: 1, 
    paddingVertical: 12, 
    borderRadius: 8, 
    alignItems: 'center', 
    marginHorizontal: 4, 
    minHeight: 48, 
    justifyContent: 'center' 
  },
  cancelBtn: { 
    borderWidth: 1 
  },
  cancelBtnText: { 
    fontSize: 14, 
    fontWeight: '600', 
    includeFontPadding: false 
  },
  saveBtn: { 
    backgroundColor: '#4CAF50' 
  },
  saveBtnText: { 
    color: '#ffffff', 
    fontSize: 14, 
    fontWeight: '600', 
    includeFontPadding: false 
  },
});

export default DishGroupManagement;