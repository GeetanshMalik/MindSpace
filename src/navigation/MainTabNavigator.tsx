import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';
import { Typography } from '../theme';
import { useColors } from '../theme/useColors';

import { HomeScreen } from '../screens/home/HomeScreen';
import { CommunityFeedScreen } from '../screens/community/CommunityFeedScreen';
import { ChatCommunitiesScreen } from '../screens/chat/ChatCommunitiesScreen';
import { AIChatScreen } from '../screens/chat/AIChatScreen';
import { CommunityChatScreen } from '../screens/chat/CommunityChatScreen';
import { DirectMessageScreen } from '../screens/chat/DirectMessageScreen';
import { UserProfileScreen } from '../screens/profile/UserProfileScreen';
import { MoodJournalScreen } from '../screens/journal/MoodJournalScreen';
import { WriteReflectionScreen } from '../screens/journal/WriteReflectionScreen';
import { ReflectionViewerScreen } from '../screens/journal/ReflectionViewerScreen';
import { CalmRoomScreen } from '../screens/calm/CalmRoomScreen';
import { PostDiscussionScreen } from '../screens/community/PostDiscussionScreen';
import { NotificationsScreen } from '../screens/notifications/NotificationsScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { PrivacyPolicyScreen } from '../screens/settings/PrivacyPolicyScreen';
import { TermsScreen } from '../screens/settings/TermsScreen';
import { HiddenPostsScreen } from '../screens/settings/HiddenPostsScreen';
import { SavedPostsScreen } from '../screens/settings/SavedPostsScreen';
import { ViewProfileScreen } from '../screens/profile/ViewProfileScreen';
import { AboutAppScreen } from '../screens/settings/AboutAppScreen';
import { FeedbackSupportScreen } from '../screens/settings/FeedbackSupportScreen';
import { SelfAssessmentScreen } from '../screens/resources/SelfAssessmentScreen';
import { ExpertArticlesScreen } from '../screens/resources/ExpertArticlesScreen';
import { translateText } from '../i18n';
import { useThemeStore } from '../store/themeStore';

export type MainTabParamList = {
    HomeTab: undefined;
    CommunityTab: undefined;
    ChatTab: undefined;
    ProfileTab: undefined;
};

export type HomeStackParamList = {
    Home: undefined;
    MoodJournal: undefined;
    WriteReflection: { reflectionId?: string; moodScore?: number; moodLabel?: string; moodEmoji?: string };
    ReflectionViewer: { reflectionId: string };
    CalmRoom: undefined;
    SelfAssessment: undefined;
    ExpertArticles: undefined;
    Notifications: undefined;
    Settings: undefined;
    PrivacyPolicy: undefined;
    Terms: undefined;
    AboutApp: undefined;
    HiddenPosts: undefined;
    SavedPosts: undefined;
    FeedbackSupport: undefined;
};

export type ChatStackParamList = {
    ChatHome: undefined;
    AIChatRoom: undefined;
    CommunityChatRoom: {
        communityId: string;
        communityName: string;
        communityEmoji: string;
        membersCount: number;
        isMember: boolean;
    };
    DirectMessage: {
        friendId: string;
        friendName: string;
    };
};

export type CommunityStackParamList = {
    CommunityFeed: { openCommentsPostId?: string; highlightCommentId?: string; notificationNonce?: number } | undefined;
    PostDiscussion: { postId: string };
    ViewProfile: { userId: string; userName: string };
};

const Tab = createBottomTabNavigator<MainTabParamList>();
const HomeStack = createStackNavigator<HomeStackParamList>();
const ChatStack = createStackNavigator<ChatStackParamList>();
const CommunityStack = createStackNavigator<CommunityStackParamList>();

const HomeStackNavigator = () => (
    <HomeStack.Navigator screenOptions={{ headerShown: false }}>
        <HomeStack.Screen name="Home" component={HomeScreen} />
        <HomeStack.Screen name="MoodJournal" component={MoodJournalScreen} />
        <HomeStack.Screen name="WriteReflection" component={WriteReflectionScreen} />
        <HomeStack.Screen name="ReflectionViewer" component={ReflectionViewerScreen} />
        <HomeStack.Screen name="CalmRoom" component={CalmRoomScreen} />
        <HomeStack.Screen name="SelfAssessment" component={SelfAssessmentScreen} />
        <HomeStack.Screen name="ExpertArticles" component={ExpertArticlesScreen} />
        <HomeStack.Screen name="Notifications" component={NotificationsScreen} />
        <HomeStack.Screen name="Settings" component={SettingsScreen} />
        <HomeStack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
        <HomeStack.Screen name="Terms" component={TermsScreen} />
        <HomeStack.Screen name="AboutApp" component={AboutAppScreen} />
        <HomeStack.Screen name="HiddenPosts" component={HiddenPostsScreen} />
        <HomeStack.Screen name="SavedPosts" component={SavedPostsScreen} />
        <HomeStack.Screen name="FeedbackSupport" component={FeedbackSupportScreen} />
    </HomeStack.Navigator>
);

const ChatStackNavigator = () => (
    <ChatStack.Navigator screenOptions={{ headerShown: false }}>
        <ChatStack.Screen name="ChatHome" component={ChatCommunitiesScreen} />
        <ChatStack.Screen name="AIChatRoom" component={AIChatScreen} />
        <ChatStack.Screen name="CommunityChatRoom" component={CommunityChatScreen} />
        <ChatStack.Screen name="DirectMessage" component={DirectMessageScreen} />
    </ChatStack.Navigator>
);

const CommunityStackNavigator = () => (
    <CommunityStack.Navigator screenOptions={{ headerShown: false }}>
        <CommunityStack.Screen name="CommunityFeed" component={CommunityFeedScreen} />
        <CommunityStack.Screen name="PostDiscussion" component={PostDiscussionScreen} />
        <CommunityStack.Screen name="ViewProfile" component={ViewProfileScreen} />
    </CommunityStack.Navigator>
);

export const MainTabNavigator = () => {
    const C = useColors();
    const language = useThemeStore((state) => state.language);
    const t = (value: string) => translateText(value, language);
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
                headerShown: false,
                tabBarHideOnKeyboard: true,
                tabBarStyle: {
                    backgroundColor: `${C.surface}B3`,
                    borderTopWidth: 0,
                    elevation: 0,
                    height: 70,
                    paddingBottom: 10,
                },
                tabBarActiveTintColor: C.primary,
                tabBarInactiveTintColor: C.onSurfaceVariant,
                tabBarLabelStyle: {
                    fontFamily: Typography.fontFamily.medium,
                    fontSize: 11,
                },
                tabBarIcon: ({ color, size, focused }) => {
                    const iconMap: Record<string, [string, string]> = {
                        HomeTab: ['home', 'home-outline'],
                        CommunityTab: ['people', 'people-outline'],
                        ChatTab: ['chatbubbles', 'chatbubbles-outline'],
                        ProfileTab: ['person', 'person-outline'],
                    };
                    const [activeIcon, inactiveIcon] = iconMap[route.name] || ['ellipse', 'ellipse-outline'];
                    return <Ionicons name={(focused ? activeIcon : inactiveIcon) as any} size={size} color={color} />;
                },
            })}
        >
            <Tab.Screen name="HomeTab" component={HomeStackNavigator} options={{ title: t('Home') }}
                listeners={({ navigation, route }) => ({
                    tabPress: e => {
                        e.preventDefault();
                        (navigation as any).navigate(route.name, { screen: 'Home' });
                    },
                })}
            />
            <Tab.Screen name="CommunityTab" component={CommunityStackNavigator} options={{ title: t('Community') }}
                listeners={({ navigation, route }) => ({
                    tabPress: e => {
                        e.preventDefault();
                        (navigation as any).navigate(route.name, { screen: 'CommunityFeed' });
                    },
                })}
            />
            <Tab.Screen name="ChatTab" component={ChatStackNavigator} options={{ title: t('Chat') }}
                listeners={({ navigation, route }) => ({
                    tabPress: e => {
                        e.preventDefault();
                        (navigation as any).navigate(route.name, { screen: 'ChatHome' });
                    },
                })}
            />
            <Tab.Screen name="ProfileTab" component={UserProfileScreen} options={{ title: t('Profile') }} />
        </Tab.Navigator>
    );
};
