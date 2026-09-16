// screens/PastCollections.jsx
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ImageBackground,
    Image,
    ActivityIndicator,
    FlatList,
} from 'react-native';
import dictionary from '../localization/dictionary';
import LanguageToggle from '../components/LanguageToggle';
import { fetchCollections } from '../services/collectionsService';
import { fetchClassifications } from '../services/classificationService';
import { getClient } from '../services/clientService';
import profileImageSelector from '../helper/profileImageSelector';
import dateFormater from '../helper/dateFormatter';
import { COLORS, SHADOWS, BORDER_RADIUS } from '../helper/theme';

const PastCollections = ({ screenNames, navigation }) => {
    const handleGoBack = () => navigation.navigate(screenNames.HOME);

    // ── Tabs ──────────────────────────────────────────────────────────────────────
    const [tabSelected, setTabSelected] = useState('collected'); // 'collected' | 'classified'

    // ── Pagination state (Collections) ────────────────────────────────────────────
    const [collections, setCollections] = useState([]);
    const [collectionsCursor, setCollectionsCursor] = useState(null);
    const [collectionsLoading, setCollectionsLoading] = useState(false);
    const [collectionsDone, setCollectionsDone] = useState(false);

    // ── Pagination state (Classifications) ────────────────────────────────────────
    const [classifications, setClassifications] = useState([]);
    const [classificationsCursor, setClassificationsCursor] = useState(null);
    const [classificationsLoading, setClassificationsLoading] = useState(false);
    const [classificationsDone, setClassificationsDone] = useState(false);

    // ── Client directory cache (clientId -> client object) ────────────────────────
    const [clientDir, setClientDir] = useState(new Map());
    const inFlight = useRef(new Set()); // avoid duplicate requests

    const primeClientDir = useCallback(async (ids) => {
        const need = [];
        ids.forEach((id) => {
            if (!id) return;
            if (!clientDir.has(id) && !inFlight.current.has(id)) {
                inFlight.current.add(id);
                need.push(id);
            }
        });
        if (need.length === 0) return;

        try {
            const results = await Promise.allSettled(need.map((id) => getClient(id)));
            setClientDir((prev) => {
                const next = new Map(prev);
                results.forEach((res, i) => {
                    const id = need[i];
                    if (res.status === 'fulfilled' && res.value) {
                        next.set(id, res.value);
                    } else {
                        // Cache a sentinel to avoid hammering the API repeatedly
                        next.set(id, null);
                    }
                    inFlight.current.delete(id);
                });
                return next;
            });
        } catch (e) {
            // Shouldn't reach here because of allSettled, but keep safe
            need.forEach((id) => inFlight.current.delete(id));
            console.error('Error prefetching client details:', e);
        }
    }, [clientDir]);

    // Resolve names for display, no mutation of Firestore docs
    const resolveNames = useCallback(
        (clientId, locationId) => {
            const client = clientDir.get(clientId);
            const clientName = client?.client_name ?? '-';

            let locationName = '—';
            if (client && Array.isArray(client.locations) && locationId) {
                const idStr = String(locationId);
                const found = client.locations.find(
                    (l) => String(l?.id) === idStr
                );
                locationName = found?.name ?? '—';
            } else if (locationId) {
                // Fallback while client still loading
                locationName = locationId;
            }

            return { clientName, locationName };
        },
        [clientDir]
    );

    // ── Utilities ────────────────────────────────────────────────────────────────
    const appendUniqueById = (prev, next) => {
        const seen = new Set(prev.map((x) => x.id));
        const merged = [...prev];
        next.forEach((x) => {
            if (!seen.has(x.id)) merged.push(x);
        });
        return merged;
    };

    // Sum "count" fields to get total number of bags
    const sumBagCount = (arr) => {
        if (!Array.isArray(arr)) return 0;
        let total = 0;
        for (const it of arr) {
            const c = Number(it?.count);
            if (Number.isFinite(c)) total += c;
        }
        return total;
    };

    const formatWhen = (ts) => {
        const d =
            ts?.toDate?.() ??
            (typeof ts?.seconds === 'number' ? new Date(ts.seconds * 1000) : ts);
        return dateFormater(d);
    };

    const safeSumWeights = (arr) => {
        if (!Array.isArray(arr)) return null;
        let total = 0;
        let found = false;
        for (const it of arr) {
            const maybe =
                typeof it?.weight === 'number'
                    ? it.weight
                    : typeof it?.kg === 'number'
                        ? it.kg
                        : Number.isFinite(Number(it?.amount))
                            ? Number(it.amount)
                            : NaN;
            if (!Number.isNaN(maybe)) {
                total += maybe;
                found = true;
            }
        }
        return found ? parseFloat(total.toFixed(2)) : null;
    };

    // ── Loaders (Collections) ────────────────────────────────────────────────────
    const loadCollections = useCallback(async () => {
        if (collectionsLoading || collectionsDone) return;
        try {
            setCollectionsLoading(true);
            const { items, nextCursor } = await fetchCollections({
                pageSize: 20,
                cursor: collectionsCursor,
                unclassifiedOnly: true,
                // clientId: 'optional-filter',
            });
            setCollections((prev) => appendUniqueById(prev, items));
            setCollectionsCursor(nextCursor);
            if (!nextCursor) setCollectionsDone(true);

            // Prefetch client details for new items
            const ids = new Set(items.map((it) => it.clientId).filter(Boolean));
            primeClientDir(ids);
        } catch (e) {
            console.error('Failed to fetch collections:', e);
        } finally {
            setCollectionsLoading(false);
        }
    }, [collectionsLoading, collectionsDone, collectionsCursor, primeClientDir]);

    // ── Loaders (Classifications) ────────────────────────────────────────────────
    const loadClassifications = useCallback(async () => {
        if (classificationsLoading || classificationsDone) return;
        try {
            setClassificationsLoading(true);
            const { items, nextCursor } = await fetchClassifications({
                pageSize: 20,
                cursor: classificationsCursor,
                // clientId: 'optional-filter',
                // collectionId: 'optional-filter',
            });
            setClassifications((prev) => appendUniqueById(prev, items));
            setClassificationsCursor(nextCursor);
            if (!nextCursor) setClassificationsDone(true);

            // Prefetch client details for new items
            const ids = new Set(items.map((it) => it.clientId).filter(Boolean));
            primeClientDir(ids);
        } catch (e) {
            console.error('Failed to fetch classifications:', e);
        } finally {
            setClassificationsLoading(false);
        }
    }, [classificationsLoading, classificationsDone, classificationsCursor, primeClientDir]);

    // Initial load for the default tab
    useEffect(() => {
        loadCollections();
    }, [loadCollections]);

    // Lazy-load the other tab the first time it’s opened
    useEffect(() => {
        if (tabSelected === 'classified' && classifications.length === 0) {
            loadClassifications();
        }
    }, [tabSelected, loadClassifications, classifications.length]);

    // ── Renderers ────────────────────────────────────────────────────────────────
    const renderCollectionItem = useCallback(
        ({ item }) => {
            const { clientName, locationName } = resolveNames(item.clientId, item.location);
            const bagCount = sumBagCount(item.collections);
            return (
                <RecordCard
                    when={formatWhen(item.timeStamp)}
                    clientName={clientName}
                    locationName={locationName}
                    totalWeight={safeSumWeights(item.collections)}
                    itemCount={Array.isArray(item.collections) ? item.collections.length : 0}
                    bagCount={bagCount}
                    onEdit={() => navigation.navigate(screenNames.COLLECT, { collection: item })}
                    dictionary={dictionary}
                    kind="collection"
                />
            );
        },
        [navigation, screenNames, resolveNames]
    );

    const renderClassificationItem = useCallback(
        ({ item }) => {
            const { clientName, locationName } = resolveNames(item.clientId, item.location);            
            const classificationCount = Array.isArray(item.classifications) ? item.classifications.length : 0;
            return (
                <RecordCard
                    when={formatWhen(item.collectionTimeStamp)}
                    classifiedWhen={item.timeStamp ? formatWhen(item.timeStamp) : null}
                    clientName={clientName}
                    locationName={locationName}
                    totalWeight={safeSumWeights(item.classifications)}
                    itemCount={
                        Array.isArray(item.classifications) ? item.classifications.length : 0
                    }
                    relatedId={item.collectionId}
                    // bagCount={classificationCount}
                    onEdit={() =>
                        navigation.navigate(screenNames.CLASSIFY, { classification: item })
                    }
                    dictionary={dictionary}
                    kind="classification"
                />
            );
        },
        [navigation, screenNames, resolveNames]
    );

    const footerCollections = useMemo(
        () => (
            <ListFooter
                loading={collectionsLoading}
                hasMore={!collectionsDone}
                onLoadMore={loadCollections}
            />
        ),
        [collectionsLoading, collectionsDone, loadCollections]
    );

    const footerClassifications = useMemo(
        () => (
            <ListFooter
                loading={classificationsLoading}
                hasMore={!classificationsDone}
                onLoadMore={loadClassifications}
            />
        ),
        [classificationsLoading, classificationsDone, loadClassifications]
    );

    // ── UI ───────────────────────────────────────────────────────────────────────
    return (
        <ImageBackground
            source={require('../assets/background_7.jpg')}
            style={styles.backgroundImage}
        >
            <LanguageToggle style={{ position: 'absolute', top: 50, right: 24, zIndex: 10 }} />
            <View style={styles.headerContainer}>
                <TouchableOpacity onPress={handleGoBack}>
                    <Text style={styles.backButton}>{dictionary?.sharedFields.goBack}</Text>
                </TouchableOpacity>
                <Text style={styles.title}>{dictionary.sharedFields.history}</Text>
            </View>

            <TabSelector
                tabSelected={tabSelected}
                dictionary={dictionary}
                setTabSelected={setTabSelected}
            />

            {tabSelected === 'collected' ? (
                <FlatList
                    contentContainerStyle={styles.list}
                    data={collections}
                    keyExtractor={(item) => item.id}
                    renderItem={renderCollectionItem}
                    onEndReachedThreshold={0.6}
                    onEndReached={loadCollections}
                    ListFooterComponent={footerCollections}
                />
            ) : (
                <FlatList
                    contentContainerStyle={styles.list}
                    data={classifications}
                    keyExtractor={(item) => item.id}
                    renderItem={renderClassificationItem}
                    onEndReachedThreshold={0.6}
                    onEndReached={loadClassifications}
                    ListFooterComponent={footerClassifications}
                />
            )}
        </ImageBackground>
    );
};

/** ---------------- Styles & Subcomponents ---------------- */

const styles = StyleSheet.create({
    backgroundImage: { flex: 1, width: '100%', height: '100%' },
    headerContainer: {
        backgroundColor: COLORS.overlayDark,
        paddingTop: 50,
        paddingHorizontal: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    backButton: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '600',
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: BORDER_RADIUS.round,
        alignSelf: 'flex-start',
    },
    title: {
        color: COLORS.white,
        paddingTop: 15,
        fontSize: 32,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    list: { 
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 30,
    },
});

const cardStyles = StyleSheet.create({
    container: {        
        padding: 20,
        backgroundColor: COLORS.glassLight,
        marginBottom: 12,
        borderRadius: BORDER_RADIUS.large,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...SHADOWS.medium,
        borderWidth: 1,
        borderColor: COLORS.borderDark,
    },
    dataContainer: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingRight: 10 },
    badgeContainer: {
        width: 10,
        height: 50,
        borderRadius: BORDER_RADIUS.small,
        marginRight: 15,
    },
    infoContainer: {
        flex: 1,
    },
    when: { color: COLORS.textDark, fontSize: 18, fontWeight: '700', marginBottom: 4 },
    text: { color: COLORS.textMedium, fontSize: 15, lineHeight: 20, marginTop: 2 },
    editButtonContainer: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: BORDER_RADIUS.medium,
        backgroundColor: COLORS.primary,
        ...SHADOWS.light,
    },
    editButtonText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
    subText: { color: COLORS.textLight, fontSize: 12, marginTop: 4 },
});

const RecordCard = ({
    when,
    classifiedWhen,
    clientName,
    locationName,
    totalWeight,
    itemCount,
    relatedId,
    onEdit,
    dictionary,
    bagCount,
    kind, // 'collection' | 'classification'
}) => {
    const badgeColor = kind === 'collection' ? COLORS.primary : COLORS.secondary;

    return (
        <View style={cardStyles.container}>
            <View style={cardStyles.dataContainer}>
                <View style={[cardStyles.badgeContainer, { backgroundColor: badgeColor }]} />
                <View style={cardStyles.infoContainer}>
                    <Text style={cardStyles.when}>{when}</Text>
                    <Text style={cardStyles.text}>
                        {`${dictionary.sharedFields.client}: ${clientName}`}
                    </Text>
                    <Text style={cardStyles.text}>
                        {`${dictionary.sharedFields.location}: ${locationName}`}
                    </Text>

                    <Text style={cardStyles.text}>
                        {`${dictionary.sharedFields.weight}: ${totalWeight ?? 0} Kg`}
                    </Text>
                    {typeof bagCount === 'number' ? (
                        <Text style={cardStyles.text}>
                            {`${dictionary.history.numberOfBags}: ${bagCount}`}
                        </Text>
                    ) : null}
                    {kind === 'classification' && classifiedWhen ? (
                        <Text style={cardStyles.subText}>{`${dictionary.history.classified}: ${classifiedWhen}`}</Text>
                    ) : null}
                </View>
            </View>

            <TouchableOpacity onPress={onEdit} style={cardStyles.editButtonContainer}>
                <Text style={cardStyles.editButtonText}>{dictionary.sharedFields.edit}</Text>
            </TouchableOpacity>
        </View>
    );
};

const TabSelector = ({ tabSelected, dictionary, setTabSelected }) => {
    const handleChangeTab = (newTab) => setTabSelected(newTab);
    return (
        <View style={tabSelectorStyles.container}>
            <TouchableOpacity
                onPress={() => handleChangeTab('collected')}
                style={[
                    tabSelectorStyles.tabOptionContainer,
                    tabSelected === 'collected' ? tabSelectorStyles.tabOptionActive : null
                ]}
            >
                <Text
                    style={
                        tabSelected === 'collected'
                            ? tabSelectorStyles.tabOptionSelectedText
                            : tabSelectorStyles.tabOptionDeselectedText
                    }
                >
                    {dictionary.history.collected}
                </Text>
            </TouchableOpacity>
            <TouchableOpacity
                onPress={() => handleChangeTab('classified')}
                style={[
                    tabSelectorStyles.tabOptionContainer,
                    tabSelected === 'classified' ? tabSelectorStyles.tabOptionActive : null
                ]}
            >
                <Text
                    style={
                        tabSelected === 'classified'
                            ? tabSelectorStyles.tabOptionSelectedText
                            : tabSelectorStyles.tabOptionDeselectedText
                    }
                >
                    {dictionary.history.classified}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const tabSelectorStyles = StyleSheet.create({
    container: {
        backgroundColor: COLORS.glassDark,
        flexDirection: 'row',
        padding: 8,
        marginHorizontal: 16,
        marginVertical: 16,
        borderRadius: BORDER_RADIUS.large,
        ...SHADOWS.light,
    },
    tabOptionContainer: {
        flex: 1,
        paddingVertical: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: BORDER_RADIUS.medium,
    },
    tabOptionActive: {
        backgroundColor: COLORS.white,
        ...SHADOWS.light,
    },
    tabOptionDeselectedText: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 16, fontWeight: '600' },
    tabOptionSelectedText: { color: COLORS.textDark, fontWeight: '800', fontSize: 16 },
});

const ListFooter = ({ loading, hasMore, onLoadMore }) => {
    if (loading) {
        return (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <ActivityIndicator color={COLORS.primary} />
            </View>
        );
    }
    if (!hasMore) {
        return (
            <View style={{ paddingVertical: 20, alignItems: 'center' }}>
                <Text style={{ color: COLORS.white, fontWeight: '600', fontSize: 14, opacity: 0.8 }}>
                    — {dictionary?.sharedFields?.noMore ?? 'No more items'} —
                </Text>
            </View>
        );
    }
    return (
        <View style={{ paddingVertical: 20, alignItems: 'center' }}>
            <TouchableOpacity onPress={onLoadMore} style={cardStyles.editButtonContainer}>
                <Text style={cardStyles.editButtonText}>
                    {dictionary?.sharedFields?.loadMore ?? 'Load more'}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

export default PastCollections;