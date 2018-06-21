port module Menu exposing (view, ItemSpec, Classes, Actions, Config, State)

import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (onMouseEnter, onMouseLeave, onWithOptions)
import Json.Decode as Json


-- MODEL


type alias ItemSpec =
    { label : String
    , submenu : Maybe (List String)
    }


type alias Classes =
    { menu : String
    , item : String
    , submenu : String
    , subitem : String
    , highlight : String
    }


type alias Actions msg =
    { activateTopItem : Maybe Int -> msg
    , activateSubItem : Maybe Int -> msg
    , selectCurrentItem : msg
    }


type alias Config msg =
    { classes : Classes
    , actions : Actions msg
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
        [ class config.classes.menu ]
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
    in
        li
            [ classList
                [ ( config.classes.item, True )
                , ( config.classes.highlight, isActive )
                ]
            , onMouseEnter <| config.actions.activateTopItem (Just index)
            , onMouseLeave <| config.actions.activateTopItem Nothing
            , onClick config.actions.selectCurrentItem
            ]
            ([ text item.label ] ++ maybeSubMenu)


viewSubMenu : Config msg -> State -> List String -> Html msg
viewSubMenu config state labels =
    ul
        [ class config.classes.submenu ]
        (List.indexedMap (viewSubItem config state) labels)


viewSubItem : Config msg -> State -> Int -> String -> Html msg
viewSubItem config state index label =
    li
        [ classList
            [ ( config.classes.subitem, True )
            , ( config.classes.highlight, state.activeSub == Just index )
            ]
        , onMouseEnter <| config.actions.activateSubItem (Just index)
        , onMouseLeave <| config.actions.activateSubItem Nothing
        , onClick config.actions.selectCurrentItem
        ]
        [ text label ]


onClick : msg -> Attribute msg
onClick msg =
    onWithOptions
        "click"
        { stopPropagation = True
        , preventDefault = False
        }
        (Json.succeed msg)
