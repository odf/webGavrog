module Menu exposing (Actions, Config, ItemSpec, State, view)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onMouseEnter, onMouseLeave, stopPropagationOn)
import Json.Decode as Json



-- MODEL


type alias ItemSpec =
    { label : String
    , submenu : Maybe (List String)
    }


type alias Actions msg =
    { activateTopItem : Maybe ( Int, String ) -> msg
    , activateSubItem : Maybe ( Int, String ) -> msg
    , selectCurrentItem : msg
    }


type alias Config msg =
    { actions : Actions msg
    , items : List ItemSpec
    }


type alias State =
    { active : Maybe Int
    , activeSub : Maybe Int
    }



-- VIEW


view : Config msg -> State -> Html msg
view config state =
    ul
        [ class "infoBoxMenu" ]
        (List.indexedMap (viewItem config state) config.items)


viewItem : Config msg -> State -> Int -> ItemSpec -> Html msg
viewItem config state index item =
    let
        isActive =
            state.active == Just index

        maybeSubMenu =
            case item.submenu of
                Nothing ->
                    []

                Just sub ->
                    if isActive then
                        [ viewSubMenu config state sub ]

                    else
                        []

        maybeClickHandler =
            case item.submenu of
                Nothing ->
                    [ onClick config.actions.selectCurrentItem ]

                Just _ ->
                    []
    in
    li
        ([ classList
            [ ( "infoBoxMenuItem", True )
            , ( "infoBoxMenuHighlight", isActive )
            ]
         , onMouseEnter <|
            config.actions.activateTopItem (Just ( index, item.label ))
         , onMouseLeave <| config.actions.activateTopItem Nothing
         ]
            ++ maybeClickHandler
        )
        ([ text item.label ] ++ maybeSubMenu)


viewSubMenu : Config msg -> State -> List String -> Html msg
viewSubMenu config state labels =
    ul
        [ class "infoBoxMenuSubmenu" ]
        (List.indexedMap (viewSubItem config state) labels)


viewSubItem : Config msg -> State -> Int -> String -> Html msg
viewSubItem config state index label =
    li
        [ classList
            [ ( "infoBoxMenuSubmenuItem", True )
            , ( "infoBoxMenuHighlight", state.activeSub == Just index )
            ]
        , onMouseEnter <|
            config.actions.activateSubItem (Just ( index, label ))
        , onMouseLeave <| config.actions.activateSubItem Nothing
        , onClick config.actions.selectCurrentItem
        ]
        [ text label ]


onClick : msg -> Attribute msg
onClick msg =
    stopPropagationOn "click" (Json.map always (Json.succeed msg))


always : msg -> ( msg, Bool )
always msg =
    ( msg, True )
